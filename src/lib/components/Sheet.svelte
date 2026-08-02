<script lang="ts">
    import { createEventDispatcher, onDestroy } from "svelte";
    import { fade, fly } from "svelte/transition";
    import { X } from "lucide-svelte";
    import { motion } from "$lib/motion";

    export let open = false;
    export let title: string;
    /** Hide the built-in header when the caller wants a fully custom layout. */
    export let showHeader = true;
    export let labelledBy = `sheet-title-${Math.random().toString(36).slice(2, 9)}`;

    const dispatch = createEventDispatcher<{ close: void }>();

    let panel: HTMLDivElement | null = null;
    let previouslyFocused: HTMLElement | null = null;

    function close() {
        dispatch("close");
    }

    function onKeydown(event: KeyboardEvent) {
        if (!open) return;

        if (event.key === "Escape") {
            event.preventDefault();
            close();
            return;
        }

        if (event.key !== "Tab" || !panel) return;

        const focusable = panel.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (event.shiftKey && (active === first || !panel.contains(active))) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
        }
    }

    function lockScroll(locked: boolean) {
        if (typeof document === "undefined") return;
        document.body.style.overflow = locked ? "hidden" : "";
    }

    // Lock the page behind the sheet and move focus into it, then hand focus back.
    $: if (typeof document !== "undefined") {
        if (open) {
            previouslyFocused = document.activeElement as HTMLElement | null;
            lockScroll(true);
        } else {
            lockScroll(false);
            previouslyFocused?.focus?.();
            previouslyFocused = null;
        }
    }

    $: if (open && panel) {
        panel.querySelector<HTMLElement>("[data-autofocus]")?.focus() ?? panel.focus();
    }

    onDestroy(() => lockScroll(false));
</script>

<svelte:window on:keydown={onKeydown} />

{#if open}
    <button
        type="button"
        class="fixed inset-0 z-[60] bg-slate-950/40"
        aria-label="ปิด"
        tabindex="-1"
        on:click={close}
        transition:fade={{ duration: motion.duration.base, easing: motion.easing.standard }}
    ></button>

    <div
        bind:this={panel}
        class="sheet-panel mx-auto max-w-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabindex="-1"
        in:fly={{ y: 20, duration: motion.duration.slow, easing: motion.easing.enter }}
        out:fly={{ y: 12, duration: motion.duration.fast, easing: motion.easing.exit }}
    >
        {#if showHeader}
            <div class="mb-4 flex items-center justify-between">
                <h2 id={labelledBy} class="text-lg font-bold text-text">{title}</h2>
                <button
                    type="button"
                    class="-mr-2 flex h-11 w-11 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-muted"
                    aria-label="ปิด"
                    on:click={close}
                >
                    <X size={18} />
                </button>
            </div>
        {:else}
            <h2 id={labelledBy} class="sr-only">{title}</h2>
        {/if}

        <slot />
    </div>
{/if}
