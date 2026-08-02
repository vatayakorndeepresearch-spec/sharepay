import type { SupabaseClient } from '@supabase/supabase-js';
import { SlipExtractionSchema } from '$lib/types/slip';

/**
 * Persists the extraction that filled the expense form. Failures are logged and
 * swallowed — an audit row must never block expense creation.
 */
export async function recordSlipExtraction(
    supabase: SupabaseClient,
    rawJson: string | null,
    expenseId: string | null,
    storagePath: string | null
): Promise<void> {
    if (!rawJson || !storagePath) return;

    let payload: any;
    try {
        payload = JSON.parse(rawJson);
    } catch {
        console.warn('[slip-extractions] ignored unparseable extraction payload');
        return;
    }

    const parsed = SlipExtractionSchema.safeParse(payload);
    if (!parsed.success) {
        console.warn('[slip-extractions] ignored invalid extraction payload');
        return;
    }

    const provider = typeof payload.provider === 'string' ? payload.provider : 'tesseract-fallback';
    const model = typeof payload.model === 'string' ? payload.model : null;

    const { error } = await supabase.from('slip_extractions').insert({
        expense_id: expenseId,
        storage_path: storagePath,
        provider,
        model,
        extraction: parsed.data,
        trans_ref: parsed.data.trans_ref,
        bank: parsed.data.bank,
        confidence: parsed.data.confidence
    });

    if (error) {
        console.error('[slip-extractions] insert failed:', error.message);
    }
}
