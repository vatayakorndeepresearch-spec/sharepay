import { cubicIn, cubicOut } from "svelte/easing";

/** Shared motion values for Svelte transitions. CSS equivalents live in app.css. */
export const motion = {
    duration: {
        fast: 120,
        base: 180,
        slow: 240
    },
    easing: {
        enter: cubicOut,
        exit: cubicIn,
        standard: cubicOut
    }
} as const;
