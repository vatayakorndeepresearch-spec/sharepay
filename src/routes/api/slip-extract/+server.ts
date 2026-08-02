import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BANK_CODES, EMPTY_EXTRACTION } from '$lib/types/slip';
import { SlipProviderError, extractSlip } from '$lib/server/slipProviders';
import { parseSlipRequest } from '$lib/server/slipRequest';

type DuplicateRow = { expense_id: string | null; created_at: string };

async function findDuplicate(supabase: SupabaseClient, transRef: string): Promise<DuplicateRow | null> {
    const { data, error } = await supabase
        .from('slip_extractions')
        .select('expense_id, created_at')
        .eq('trans_ref', transRef)
        .order('created_at', { ascending: true })
        .limit(1);

    if (error) {
        console.warn('[slip-extract] dedupe lookup skipped:', error.message);
        return null;
    }
    return (data?.[0] as DuplicateRow) ?? null;
}

export const POST: RequestHandler = async ({ request, locals: { supabase, user } }) => {
    if (!user) {
        return json({ error: 'unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return json({ error: 'invalid JSON body' }, { status: 400 });
    }

    const parsedRequest = parseSlipRequest(body);
    if (!parsedRequest.ok) {
        return json({ error: parsedRequest.error }, { status: parsedRequest.status });
    }

    const { imageBase64, mimeType, hint } = parsedRequest;

    // QR trans_ref already recorded → answer from the DB and skip the provider
    // call entirely (the user gets the duplicate notice either way).
    if (hint?.transRef) {
        const duplicate = await findDuplicate(supabase, hint.transRef);
        if (duplicate) {
            console.log('[slip-extract] provider=qr-dedupe had_qr=true (skipped AI call)');
            return json({
                ...EMPTY_EXTRACTION,
                is_slip: true,
                bank: BANK_CODES[hint.bankCode] ?? 'UNKNOWN',
                trans_ref: hint.transRef,
                confidence: 'high',
                provider: 'qr-dedupe',
                model: null,
                duplicate_of: duplicate
            });
        }
    }

    try {
        const { extraction, provider, model, latencyMs } = await extractSlip(imageBase64, mimeType, hint);

        // Privacy: never log names, accounts, memo, or image data.
        console.log(
            `[slip-extract] provider=${provider} model=${model} latency_ms=${latencyMs} ` +
                `confidence=${extraction.confidence} is_slip=${extraction.is_slip} had_qr=${!!hint}`
        );

        // Re-check only when the AI read a ref the QR didn't already clear above.
        let duplicateOf: DuplicateRow | null = null;
        if (extraction.trans_ref && extraction.trans_ref !== hint?.transRef) {
            duplicateOf = await findDuplicate(supabase, extraction.trans_ref);
        }

        return json({ ...extraction, provider, model, duplicate_of: duplicateOf });
    } catch (err) {
        if (err instanceof SlipProviderError) {
            console.error(`[slip-extract] ${err.kind}: ${err.message}${err.detail ? ` — ${err.detail}` : ''}`);
            return json({ error: err.message, kind: err.kind }, { status: err.status });
        }
        console.error('[slip-extract] unexpected error:', (err as Error)?.message);
        return json({ error: 'extraction failed', kind: 'unextractable' }, { status: 422 });
    }
};
