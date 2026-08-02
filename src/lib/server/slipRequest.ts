import type { SlipQrHint } from '$lib/types/slip';

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function decodedByteLength(base64: string): number {
    const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export type SlipRequestResult =
    | { ok: true; imageBase64: string; mimeType: string; hint: SlipQrHint | null }
    | { ok: false; status: number; error: string };

/** Validates the /api/slip-extract payload before any money is spent on a provider. */
export function parseSlipRequest(body: unknown): SlipRequestResult {
    if (!body || typeof body !== 'object') {
        return { ok: false, status: 400, error: 'invalid JSON body' };
    }

    const raw = body as Record<string, unknown>;
    const imageBase64 =
        typeof raw.imageBase64 === 'string' ? raw.imageBase64.replace(/^data:[^;]+;base64,/, '').trim() : '';
    const mimeType = typeof raw.mimeType === 'string' ? raw.mimeType : '';

    if (!imageBase64) return { ok: false, status: 400, error: 'imageBase64 is required' };
    if (!ALLOWED_MIME.has(mimeType)) return { ok: false, status: 400, error: 'unsupported mimeType' };
    if (decodedByteLength(imageBase64) > MAX_IMAGE_BYTES) {
        return { ok: false, status: 400, error: 'image exceeds 4MB' };
    }

    const qr = raw.qrPayload as Record<string, unknown> | undefined;
    const hint: SlipQrHint | null =
        qr && typeof qr.bankCode === 'string' && typeof qr.transRef === 'string'
            ? { bankCode: qr.bankCode, transRef: qr.transRef }
            : null;

    return { ok: true, imageBase64, mimeType, hint };
}
