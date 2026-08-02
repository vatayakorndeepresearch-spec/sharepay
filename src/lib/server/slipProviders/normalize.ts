import { BANK_CODES, EMPTY_EXTRACTION, SlipExtractionSchema, type SlipExtraction, type SlipQrHint } from '$lib/types/slip';
import {
    isPlausibleDate,
    normalizeAmount,
    normalizeDate,
    normalizeTime,
    toGregorianDate,
    toGregorianYear
} from '$lib/shared/slipCore.js';

// Pure helpers live in the framework-free core (shared with the eval harness).
export { normalizeAmount, normalizeDate, normalizeTime, toGregorianDate, toGregorianYear, isPlausibleDate };

function cleanString(input: unknown): string | null {
    if (typeof input !== 'string') return null;
    const trimmed = input.trim();
    if (!trimmed || /^(null|none|n\/a|-)$/i.test(trimmed)) return null;
    return trimmed;
}

/**
 * Coerces raw model JSON into a valid SlipExtraction: field-level cleanup,
 * QR cross-checks, then schema validation. Throws when the result still cannot
 * satisfy the schema (caller maps that to a 422).
 */
export function normalizeExtraction(
    raw: Record<string, unknown>,
    hint?: SlipQrHint | null,
    now = new Date()
): SlipExtraction {
    const sender = (raw.sender ?? {}) as Record<string, unknown>;
    const receiver = (raw.receiver ?? {}) as Record<string, unknown>;

    const amount = normalizeAmount(raw.amount);
    const fee = normalizeAmount(raw.fee);
    let date = normalizeDate(raw.date);
    if (date && !isPlausibleDate(date, now)) date = null;

    const bankFromQr = hint?.bankCode ? BANK_CODES[hint.bankCode] : undefined;
    const modelBank = typeof raw.bank === 'string' ? raw.bank.toUpperCase() : 'UNKNOWN';

    const candidate = {
        ...EMPTY_EXTRACTION,
        // A parsed mini-QR only exists on a real bank slip.
        is_slip: raw.is_slip === true || !!hint,
        bank: modelBank === 'UNKNOWN' && bankFromQr ? bankFromQr : modelBank,
        direction: typeof raw.direction === 'string' ? raw.direction : 'unknown',
        amount: amount !== null && amount > 0 ? amount : null,
        fee: fee !== null && fee >= 0 ? fee : null,
        currency: 'THB' as const,
        date,
        time: normalizeTime(raw.time),
        sender: { name: cleanString(sender.name), account: cleanString(sender.account) },
        receiver: { name: cleanString(receiver.name), account: cleanString(receiver.account) },
        memo: cleanString(raw.memo),
        // QR is deterministic — it always wins over the model.
        trans_ref: hint?.transRef ?? cleanString(raw.trans_ref),
        confidence: typeof raw.confidence === 'string' ? raw.confidence : 'low'
    };

    const parsed = SlipExtractionSchema.safeParse(candidate);
    if (parsed.success) return parsed.data;

    // Second chance: drop the fields the model got structurally wrong rather than
    // failing the whole extraction.
    const salvaged = SlipExtractionSchema.safeParse({
        ...candidate,
        bank: 'UNKNOWN',
        direction: 'unknown',
        confidence: 'low'
    });
    if (salvaged.success) return salvaged.data;

    throw new Error(
        `extraction failed schema validation: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`
    );
}
