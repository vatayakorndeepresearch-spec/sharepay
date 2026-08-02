import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'sharepay:theme';

function readInitialTheme(): Theme {
    if (!browser) return 'light';
    // app.html already resolved this before first paint; trust the DOM.
    return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function createThemeStore() {
    const { subscribe, set } = writable<Theme>(readInitialTheme());

    function apply(theme: Theme) {
        if (browser) {
            document.documentElement.dataset.theme = theme;
            try {
                localStorage.setItem(STORAGE_KEY, theme);
            } catch {
                // Private mode / storage disabled — the in-memory theme still applies.
            }
        }
        set(theme);
    }

    return {
        subscribe,
        set: apply,
        toggle: () => apply(readInitialTheme() === 'dark' ? 'light' : 'dark')
    };
}

export const theme = createThemeStore();
