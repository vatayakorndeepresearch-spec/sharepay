/// <reference lib="webworker" />

/**
 * Off-main-thread slip image work.
 *
 * Both jobs walk several million pixels, and the bulk scanner runs them
 * CONCURRENCY-wide, so doing them on the main thread froze scrolling mid-scan.
 * The caller transfers an ImageBitmap in and gets bytes back; no DOM involved.
 *
 * `prepare` — downscale to a JPEG for the AI endpoint and decode the slip QR.
 * `binarize` — grayscale + contrast + adaptive threshold PNG for Tesseract.
 */

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;
const OCR_TARGET_WIDTH = 1800;

type PrepareRequest = { id: number; type: 'prepare'; bitmap: ImageBitmap };
type BinarizeRequest = { id: number; type: 'binarize'; bitmap: ImageBitmap };
type WorkerRequest = PrepareRequest | BinarizeRequest;

type Decoder = (
    data: Uint8ClampedArray,
    width: number,
    height: number,
    options?: { inversionAttempts?: 'dontInvert' | 'onlyInvert' | 'attemptBoth' | 'invertFirst' }
) => { data: string } | null;

const worker = self as unknown as DedicatedWorkerGlobalScope;

let decoderPromise: Promise<Decoder> | null = null;
function loadDecoder(): Promise<Decoder> {
    decoderPromise ??= import('jsqr').then((m) => m.default as unknown as Decoder);
    return decoderPromise;
}

function drawScaled(bitmap: ImageBitmap, width: number, height: number) {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Could not get offscreen canvas context');
    ctx.drawImage(bitmap, 0, 0, width, height);
    return { canvas, ctx };
}

/**
 * jsQR over the full frame, then over 2x-upscaled bottom crops — QR placement
 * differs per bank and small QRs need the upscale to decode. The source must
 * stay un-binarized; thresholding destroys QR modules on patterned slips.
 */
async function decodeQr(bitmap: ImageBitmap, width: number, height: number): Promise<string | null> {
    const jsQR = await loadDecoder();
    const { canvas, ctx } = drawScaled(bitmap, width, height);

    const full = ctx.getImageData(0, 0, width, height);
    const direct = jsQR(full.data, full.width, full.height, { inversionAttempts: 'attemptBoth' });
    if (direct?.data) return direct.data;

    const crops: Array<[number, number, number, number]> = [
        [width / 2, height / 2, width / 2, height / 2], // bottom-right
        [0, height / 2, width / 2, height / 2], // bottom-left
        [width / 4, height / 2, width / 2, height / 2], // bottom-center
        [0, height * 0.6, width, height * 0.4] // full-width bottom strip
    ];

    for (const [sx, sy, sw, sh] of crops) {
        const scaled = new OffscreenCanvas(Math.round(sw * 2), Math.round(sh * 2));
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

function toBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    // Chunked so a large slip cannot blow the argument limit of String.fromCharCode.
    for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
}

async function prepare(bitmap: ImageBitmap) {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const qrPayload = await decodeQr(bitmap, width, height);

    const { canvas } = drawScaled(bitmap, width, height);
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY });
    const imageBase64 = toBase64(await blob.arrayBuffer());

    return { imageBase64, qrPayload };
}

/**
 * Adaptive threshold: find the background peak in the light half of the
 * histogram and cut just below it, so textured slip backgrounds go white
 * without erasing light text.
 */
async function binarize(bitmap: ImageBitmap) {
    const scale = Math.min(1, OCR_TARGET_WIDTH / bitmap.width);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const { canvas, ctx } = drawScaled(bitmap, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const histogram = new Array(256).fill(0);
    for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        data[i] = gray;
        histogram[Math.floor(gray)]++;
    }

    let maxCount = 0;
    let backgroundPeak = 255;
    for (let i = 128; i < 256; i++) {
        if (histogram[i] > maxCount) {
            maxCount = histogram[i];
            backgroundPeak = i;
        }
    }

    const THRESHOLD_OFFSET = 25;
    const threshold = Math.max(100, backgroundPeak - THRESHOLD_OFFSET);

    const contrast = 60;
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

    for (let i = 0; i < data.length; i += 4) {
        let gray = factor * (data[i] - 128) + 128;
        gray = Math.max(0, Math.min(255, gray));
        // Text is pushed well past the threshold so Tesseract sees solid strokes.
        gray = gray > threshold ? 255 : Math.max(0, gray - 40);

        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
    }

    ctx.putImageData(imageData, 0, 0);
    return { blob: await canvas.convertToBlob({ type: 'image/png' }) };
}

worker.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
    const { id, type, bitmap } = event.data;

    try {
        const result = type === 'prepare' ? await prepare(bitmap) : await binarize(bitmap);
        worker.postMessage({ id, ok: true, result });
    } catch (error) {
        worker.postMessage({ id, ok: false, error: (error as Error)?.message || 'slip worker failed' });
    } finally {
        bitmap.close();
    }
});
