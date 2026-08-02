<script lang="ts">
    import type { ComponentType } from "svelte";

    export let icon: ComponentType | null = null;
    export let title: string;
    export let description = "";
    export let actionLabel = "";
    export let actionHref = "";
</script>

<div class="surface-card p-6 text-center">
    {#if icon}
        <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-muted text-muted">
            <svelte:component this={icon} size={22} />
        </div>
    {/if}

    <h3 class="text-base font-bold text-text">{title}</h3>

    {#if description}
        <p class="mx-auto mt-1 max-w-[36ch] text-sm text-muted">{description}</p>
    {/if}

    {#if actionLabel && actionHref}
        <a href={actionHref} class="btn-primary mt-4 inline-flex">
            {actionLabel}
        </a>
    {/if}

    <slot />
</div>
