<script lang="ts">
    import { flip } from "svelte/animate";
    import { fly } from "svelte/transition";
    import { AlertTriangle, CheckCircle2, Info, X } from "lucide-svelte";
    import { toasts } from "$lib/stores/toast";

    const styles = {
        success: "border-income/30 bg-income-soft text-income-on-soft",
        error: "border-danger/30 bg-danger-soft text-danger-on-soft",
        info: "border-border bg-surface text-soft"
    } as const;
</script>

<div
    class="pointer-events-none fixed inset-x-0 z-[90] mx-auto flex max-w-md flex-col gap-2 px-4"
    style="bottom: calc(var(--safe-bottom) + var(--nav-h) + 16px)"
    role="status"
    aria-live="polite"
>
    {#each $toasts as toast (toast.id)}
        <div
            class={`pointer-events-auto flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-sm font-medium shadow-lg ${styles[toast.kind]}`}
            animate:flip={{ duration: 180 }}
            in:fly={{ y: 12, duration: 180 }}
            out:fly={{ y: 12, duration: 120 }}
        >
            {#if toast.kind === "success"}
                <CheckCircle2 size={16} class="shrink-0" />
            {:else if toast.kind === "error"}
                <AlertTriangle size={16} class="shrink-0" />
            {:else}
                <Info size={16} class="shrink-0" />
            {/if}

            <span class="flex-1">{toast.message}</span>

            <button
                type="button"
                class="-mr-1 rounded-lg p-1 opacity-60 transition-opacity hover:opacity-100"
                aria-label="ปิดการแจ้งเตือน"
                on:click={() => toasts.dismiss(toast.id)}
            >
                <X size={14} />
            </button>
        </div>
    {/each}
</div>
