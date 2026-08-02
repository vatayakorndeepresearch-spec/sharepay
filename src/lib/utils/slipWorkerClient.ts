/**
 * Thin promise bridge to the slip worker. One worker is shared by every caller;
 * requests are correlated by id so the bulk scanner can keep several in flight.
 *
 * Returns null when the environment cannot run the worker path (no
 * OffscreenCanvas, no createImageBitmap), so callers can fall back to the
 * main-thread implementation instead of failing the scan.
 */

type PrepareResult = { imageBase64: string; qrPayload: string | null };
type BinarizeResult = { blob: Blob };

let workerInstance: Worker | null = null;
let nextRequestId = 1;
const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();

export function isSlipWorkerSupported(): boolean {
    return (
        typeof Worker !== 'undefined' &&
        typeof OffscreenCanvas !== 'undefined' &&
        typeof createImageBitmap === 'function'
    );
}

function getWorker(): Worker {
    if (!workerInstance) {
        workerInstance = new Worker(new URL('../workers/slipWorker.ts', import.meta.url), {
            type: 'module'
        });

        workerInstance.addEventListener('message', (event: MessageEvent<any>) => {
            const { id, ok, result, error } = event.data || {};
            const entry = pending.get(id);
            if (!entry) return;
            pending.delete(id);
            ok ? entry.resolve(result) : entry.reject(new Error(error || 'slip worker failed'));
        });

        workerInstance.addEventListener('error', (event) => {
            // A worker-level failure kills every request in flight; drop the instance
            // so the next call gets a fresh one.
            for (const [, entry] of pending) entry.reject(new Error(event.message || 'slip worker crashed'));
            pending.clear();
            workerInstance?.terminate();
            workerInstance = null;
        });
    }

    return workerInstance;
}

async function run<T>(type: 'prepare' | 'binarize', file: File): Promise<T | null> {
    if (!isSlipWorkerSupported()) return null;

    let bitmap: ImageBitmap;
    try {
        bitmap = await createImageBitmap(file);
    } catch {
        return null;
    }

    const id = nextRequestId++;
    return new Promise<T>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        getWorker().postMessage({ id, type, bitmap }, [bitmap]);
    });
}

/** Downscaled JPEG (base64, no data-url prefix) plus the decoded QR payload. */
export function prepareSlipInWorker(file: File): Promise<PrepareResult | null> {
    return run<PrepareResult>('prepare', file);
}

/** Binarized PNG blob for the Tesseract fallback. */
export function binarizeSlipInWorker(file: File): Promise<BinarizeResult | null> {
    return run<BinarizeResult>('binarize', file);
}

export function terminateSlipWorker() {
    workerInstance?.terminate();
    workerInstance = null;
    pending.clear();
}
