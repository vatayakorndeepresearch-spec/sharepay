import { env as publicEnv } from '$env/dynamic/public';
import { EMPTY_EXTRACTION, type SlipExtractResponse, type SlipQrHint } from '$lib/types/slip';
import { getOCRWorker } from '$lib/stores/ocrStore';
import { extractExpenseData } from '$lib/utils/expenseForm';
import { preprocessImage } from '$lib/utils/imageProcessor';
import { readSlipQrHint } from '$lib/utils/slipQr';

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;

export function isSlipAiEnabled() {
    return publicEnv.PUBLIC_SLIP_AI_ENABLED !== 'false';
}

/** Downscales to ≤1600px long edge as JPEG — no binarization (that is Tesseract-only). */
export async function downscaleToCanvas(file: File): Promise<HTMLCanvasElement> {
    const url = URL.createObjectURL(file);
    try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('Could not decode image'));
            image.src = url;
        });

        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('Could not get canvas context');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        return canvas;
    } finally {
        URL.revokeObjectURL(url);
    }
}

function canvasToBase64Jpeg(canvas: HTMLCanvasElement): string {
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1] ?? '';
}

async function tesseractFallback(file: File): Promise<SlipExtractResponse> {
    const worker = await getOCRWorker();
    const processed = await preprocessImage(file);
    const {
        data: { text }
    } = await worker.recognize(processed);
    const legacy = extractExpenseData(text);

    return {
        ...EMPTY_EXTRACTION,
        is_slip: legacy.amount !== null,
        amount: legacy.amount,
        date: legacy.date || null,
        memo: legacy.notes || null,
        confidence: 'low',
        provider: 'tesseract-fallback',
        model: null,
        duplicate_of: null
    };
}

export interface ExtractOptions {
    /** Skip the AI endpoint entirely (used by the feature flag / retry paths). */
    forceFallback?: boolean;
    signal?: AbortSignal;
}

/**
 * Full client pipeline: downscale → decode slip QR → POST /api/slip-extract,
 * degrading to the Tesseract path on any network/provider failure.
 */
export async function extractFromImage(file: File, options: ExtractOptions = {}): Promise<SlipExtractResponse> {
    if (options.forceFallback || !isSlipAiEnabled()) {
        return tesseractFallback(file);
    }

    let hint: SlipQrHint | null = null;
    let imageBase64 = '';

    try {
        const canvas = await downscaleToCanvas(file);
        hint = await readSlipQrHint(canvas);
        imageBase64 = canvasToBase64Jpeg(canvas);
    } catch (err) {
        console.error('[slip] image prep failed:', err);
        return tesseractFallback(file);
    }

    if (!imageBase64) return tesseractFallback(file);

    try {
        const response = await fetch('/api/slip-extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64, mimeType: 'image/jpeg', qrPayload: hint ?? undefined }),
            signal: options.signal
        });

        if (response.status === 429) {
            const error: any = new Error('rate limited');
            error.status = 429;
            throw error;
        }

        if (!response.ok) {
            // 4xx that is not our fault to retry: still better to fall back than to fail.
            throw new Error(`slip-extract responded ${response.status}`);
        }

        const data = (await response.json()) as SlipExtractResponse;
        return applyQrHint(data, hint);
    } catch (err: any) {
        if (err?.name === 'AbortError') throw err;
        if (err?.status === 429) throw err;
        console.warn('[slip] AI extraction failed, using Tesseract fallback:', err?.message);
        const fallback = await tesseractFallback(file);
        return applyQrHint(fallback, hint);
    }
}

function applyQrHint(result: SlipExtractResponse, hint: SlipQrHint | null): SlipExtractResponse {
    if (!hint) return result;
    return { ...result, trans_ref: result.trans_ref ?? hint.transRef, is_slip: true };
}

/** Maps an extraction onto the expense form fields. */
export function toFormFields(extraction: SlipExtractResponse) {
    const memo = extraction.memo?.trim() || '';
    const counterparty =
        extraction.direction === 'bill_payment' || !memo ? extraction.receiver.name?.trim() || '' : '';

    const notes = memo || counterparty;
    const description = memo || counterparty;

    const highlightedFields: string[] = [];
    if (extraction.amount) highlightedFields.push('amount');
    if (extraction.date) highlightedFields.push('date');
    if (notes) highlightedFields.push('notes', 'description');

    return { amount: extraction.amount, date: extraction.date, notes, description, highlightedFields };
}
