import { writable, get } from 'svelte/store';
import { createWorker, type Worker } from 'tesseract.js';

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

export const ocrStore = writable<OCRState>(initialState);

export async function getOCRWorker() {
    const state = get(ocrStore);

    if (state.worker && state.status === 'ready') {
        return state.worker;
    }

    if (state.status === 'initializing') {
        // Wait for it to become ready
        return new Promise<Worker>((resolve, reject) => {
            const unsubscribe = ocrStore.subscribe(s => {
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

    // Initialize
    ocrStore.update(s => ({ ...s, status: 'initializing' }));

    try {
        const worker = await createWorker('tha+eng');
        ocrStore.update(s => ({ ...s, worker, status: 'ready', error: null }));
        return worker;
    } catch (err: any) {
        ocrStore.update(s => ({ ...s, status: 'error', error: err.message }));
        throw err;
    }
}

export async function terminateOCRWorker() {
    const state = get(ocrStore);
    if (state.worker) {
        await state.worker.terminate();
        ocrStore.set(initialState);
    }
}
