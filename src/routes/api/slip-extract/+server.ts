import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SlipProviderError, extractSlip } from '$lib/server/slipProviders';
import { parseSlipRequest } from '$lib/server/slipRequest';

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

    try {
        const { extraction, provider, model, latencyMs } = await extractSlip(imageBase64, mimeType, hint);

        // Privacy: never log names, accounts, memo, or image data.
        console.log(
            `[slip-extract] provider=${provider} model=${model} latency_ms=${latencyMs} ` +
                `confidence=${extraction.confidence} is_slip=${extraction.is_slip} had_qr=${!!hint}`
        );

        let duplicateOf: { expense_id: string | null; created_at: string } | null = null;
        if (extraction.trans_ref) {
            const { data, error } = await supabase
                .from('slip_extractions')
                .select('expense_id, created_at')
                .eq('trans_ref', extraction.trans_ref)
                .order('created_at', { ascending: true })
                .limit(1);

            if (error) {
                console.warn('[slip-extract] dedupe lookup skipped:', error.message);
            } else if (data?.length) {
                duplicateOf = data[0] as { expense_id: string | null; created_at: string };
            }
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
