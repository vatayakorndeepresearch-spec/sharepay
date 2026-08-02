import { writable, get } from 'svelte/store';
import type { Worker } from 'tesseract.js';

interface OCRState {
    worker: Worker | null;
    status: 'idle' | 'initializing' | 'ready' | 'error';
    error: string | null;
}

const initialState: OCRState = {
    worker: null,
    status: 'idle',
    error: null
};

/** How long the (expensive) worker stays warm after the last page releases it. */
const IDLE_TERMINATE_MS = 30_000;

export const ocrStore = writable<OCRState>(initialState);

let consumers = 0;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function cancelIdleTerminate() {
    if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
    }
}

export async function getOCRWorker(): Promise<Worker> {
    cancelIdleTerminate();
    const state = get(ocrStore);

    if (state.worker && state.status === 'ready') {
        return state.worker;
    }

    if (state.status === 'initializing') {
        return new Promise<Worker>((resolve, reject) => {
            const unsubscribe = ocrStore.subscribe((s) => {
                if (s.status === 'ready' && s.worker) {
                    unsubscribe();
                    resolve(s.worker);
                } else if (s.status === 'error') {
                    unsubscribe();
                    reject(new Error(s.error || 'Failed to initialize OCR'));
                }
            });
        });
    }

    ocrStore.update((s) => ({ ...s, status: 'initializing' }));

    try {
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker('tha+eng');
        ocrStore.update((s) => ({ ...s, worker, status: 'ready', error: null }));
        return worker;
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to initialize OCR';
        ocrStore.update((s) => ({ ...s, status: 'error', error: message }));
        throw err;
    }
}

/**
 * Pages must acquire/release instead of terminating directly: the worker is a
 * singleton, so a page tearing it down used to kill scans still running elsewhere.
 */
export function acquireOCRWorker() {
    consumers += 1;
    cancelIdleTerminate();
}

export function releaseOCRWorker() {
    consumers = Math.max(0, consumers - 1);
    if (consumers > 0) return;

    cancelIdleTerminate();
    idleTimer = setTimeout(() => {
        idleTimer = null;
        if (consumers === 0) void terminateOCRWorker();
    }, IDLE_TERMINATE_MS);
}

export async function terminateOCRWorker() {
    cancelIdleTerminate();
    const state = get(ocrStore);
    if (state.worker) {
        ocrStore.set(initialState);
        await state.worker.terminate();
    }
}
