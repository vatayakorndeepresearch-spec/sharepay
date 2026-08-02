import { z } from 'zod';

export const BANKS = ['SCB', 'KBANK', 'KKP', 'BBL', 'KTB', 'BAY', 'TTB', 'GSB', 'OTHER', 'UNKNOWN'] as const;

export const SlipExtractionSchema = z.object({
    is_slip: z.boolean(),
    bank: z.enum(BANKS),
    direction: z.enum(['transfer_out', 'transfer_in', 'bill_payment', 'topup', 'unknown']),
    amount: z.number().positive().nullable(),
    fee: z.number().min(0).nullable(),
    currency: z.literal('THB').default('THB'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
    sender: z.object({ name: z.string().nullable(), account: z.string().nullable() }),
    receiver: z.object({ name: z.string().nullable(), account: z.string().nullable() }),
    memo: z.string().nullable(),
    trans_ref: z.string().nullable(),
    confidence: z.enum(['high', 'medium', 'low'])
});

export type SlipExtraction = z.infer<typeof SlipExtractionSchema>;

/** Extraction plus server-side metadata returned by /api/slip-extract. */
export interface SlipExtractResponse extends SlipExtraction {
    provider: 'typhoon' | 'openrouter' | 'tesseract-fallback' | 'qr-dedupe';
    model: string | null;
    /** Existing expense id when this trans_ref was already recorded. */
    duplicate_of?: { expense_id: string | null; created_at: string } | null;
}

export const EMPTY_EXTRACTION: SlipExtraction = {
    is_slip: false,
    bank: 'UNKNOWN',
    direction: 'unknown',
    amount: null,
    fee: null,
    currency: 'THB',
    date: null,
    time: null,
    sender: { name: null, account: null },
    receiver: { name: null, account: null },
    memo: null,
    trans_ref: null,
    confidence: 'low'
};

/** Bank code (from slip mini-QR) → schema bank enum. */
export const BANK_CODES: Record<string, (typeof BANKS)[number]> = {
    '002': 'BBL',
    '004': 'KBANK',
    '006': 'KTB',
    '011': 'TTB',
    '014': 'SCB',
    '022': 'OTHER', // CIMBT
    '024': 'OTHER', // UOBT
    '025': 'BAY',
    '030': 'GSB',
    '033': 'OTHER', // GHB
    '034': 'OTHER', // BAAC
    '067': 'OTHER', // TISCO
    '069': 'KKP',
    '070': 'OTHER', // ICBCT
    '071': 'OTHER', // TCD
    '073': 'OTHER'  // LHB
};

/** Full bank-code labels, kept separate so QR audit rows can store the real bank. */
export const BANK_CODE_LABELS: Record<string, string> = {
    '002': 'BBL',
    '004': 'KBANK',
    '006': 'KTB',
    '011': 'TTB',
    '014': 'SCB',
    '022': 'CIMBT',
    '024': 'UOBT',
    '025': 'BAY',
    '030': 'GSB',
    '033': 'GHB',
    '034': 'BAAC',
    '067': 'TISCO',
    '069': 'KKP',
    '070': 'ICBCT',
    '071': 'TCD',
    '073': 'LHB'
};

export interface SlipQrHint {
    bankCode: string;
    transRef: string;
}
