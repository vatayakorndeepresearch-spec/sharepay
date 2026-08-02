import { writable } from 'svelte/store';

export type ToastKind = 'success' | 'error' | 'info';

export type Toast = {
    id: number;
    kind: ToastKind;
    message: string;
};

const DEFAULT_DURATION = 3200;

let nextId = 1;

function createToastStore() {
    const { subscribe, update } = writable<Toast[]>([]);

    function dismiss(id: number) {
        update((all) => all.filter((toast) => toast.id !== id));
    }

    function push(kind: ToastKind, message: string, duration = DEFAULT_DURATION) {
        const id = nextId++;
        update((all) => [...all, { id, kind, message }]);
        if (duration > 0) {
            setTimeout(() => dismiss(id), duration);
        }
        return id;
    }

    return {
        subscribe,
        dismiss,
        success: (message: string, duration?: number) => push('success', message, duration),
        error: (message: string, duration?: number) => push('error', message, duration),
        info: (message: string, duration?: number) => push('info', message, duration)
    };
}

export const toasts = createToastStore();
