import { BANK_CODE_LABELS, type SlipQrHint } from '$lib/types/slip';
import { parseSlipMiniQr as parseMiniQr } from '$lib/shared/slipCore.js';

export { BANK_CODE_LABELS as BANK_CODES };

/**
 * Parses a Thai bank slip "mini QR" payload (EMV-TLV).
 *
 * Structure: [2-digit tag][2-digit length][value], repeated. Tag `00` holds a
 * nested TLV: sub-tag `00` = API id (`000001`), `01` = sending bank code,
 * `02` = transaction reference.
 */
export function parseSlipMiniQr(payload: string): SlipQrHint | null {
    return parseMiniQr(payload);
}

export function bankFromCode(bankCode: string): string | null {
    return BANK_CODE_LABELS[bankCode] ?? null;
}

type Decoder = (
    data: Uint8ClampedArray,
    width: number,
    height: number,
    options?: { inversionAttempts?: 'dontInvert' | 'onlyInvert' | 'attemptBoth' | 'invertFirst' }
) => { data: string } | null;

/**
 * Runs jsQR over the full image, then over 2x-upscaled bottom-right / bottom-left
 * / bottom-center crops — QR placement differs per bank and small QRs need the
 * upscale to decode.
 *
 * The canvas passed in must NOT be binarized; thresholding destroys QR modules
 * on the decorative slip backgrounds.
 */
export async function decodeSlipQr(canvas: HTMLCanvasElement): Promise<string | null> {
    const jsQR = (await import('jsqr')).default as unknown as Decoder;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    const full = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const direct = jsQR(full.data, full.width, full.height, { inversionAttempts: 'attemptBoth' });
    if (direct?.data) return direct.data;

    const w = canvas.width;
    const h = canvas.height;
    const crops: Array<[number, number, number, number]> = [
        [w / 2, h / 2, w / 2, h / 2], // bottom-right
        [0, h / 2, w / 2, h / 2], // bottom-left
        [w / 4, h / 2, w / 2, h / 2], // bottom-center
        [0, h * 0.6, w, h * 0.4] // full-width bottom strip
    ];

    for (const [sx, sy, sw, sh] of crops) {
        const scaled = document.createElement('canvas');
        scaled.width = Math.round(sw * 2);
        scaled.height = Math.round(sh * 2);
        const sctx = scaled.getContext('2d', { willReadFrequently: true });
        if (!sctx) continue;

        sctx.imageSmoothingEnabled = false;
        sctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, scaled.width, scaled.height);

        const cropData = sctx.getImageData(0, 0, scaled.width, scaled.height);
        const found = jsQR(cropData.data, cropData.width, cropData.height, {
            inversionAttempts: 'attemptBoth'
        });
        if (found?.data) return found.data;
    }

    return null;
}

/** Convenience: decode + parse in one call. */
export async function readSlipQrHint(canvas: HTMLCanvasElement): Promise<SlipQrHint | null> {
    try {
        const payload = await decodeSlipQr(canvas);
        return payload ? parseSlipMiniQr(payload) : null;
    } catch {
        return null;
    }
}
