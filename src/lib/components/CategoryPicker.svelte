<script lang="ts">
    import { Check, Search, Sparkles, Tag } from "lucide-svelte";
    import Sheet from "$lib/components/Sheet.svelte";
    import type { TransactionType } from "$lib/utils/expenseForm";
    import { getRecentCategories } from "$lib/utils/recentCategories";

    export let categories: readonly string[];
    export let transactionType: TransactionType;
    export let value = "";
    export let busy = false;
    export let highlighted = false;

    let showAll = false;
    let search = "";

    // Recents are read once per type change; re-reading on every keystroke is wasted work.
    $: recents = getRecentCategories(transactionType, categories);
    $: isCustom = Boolean(value) && !categories.includes(value);
    $: filtered = search.trim()
        ? categories.filter((item) => item.includes(search.trim()))
        : categories;

    function select(category: string) {
        value = value === category ? "" : category;
        showAll = false;
        search = "";
    }
</script>

<div>
    <div class="flex items-center justify-between">
        <span class="field-label mb-0">หมวดหมู่</span>
        {#if busy}
            <span class="inline-flex items-center gap-1.5 text-xs font-medium text-accent">
                <Sparkles size={12} class="animate-pulse" />
                AI กำลังวิเคราะห์...
            </span>
        {/if}
    </div>

    <div
        class={`mt-1.5 flex flex-wrap gap-1.5 rounded-xl border p-2 transition-colors ${
            highlighted ? "border-accent bg-accent-soft" : "border-border bg-surface"
        }`}
    >
        {#each recents as category (category)}
            <button
                type="button"
                class={`filter-chip ${value === category ? "filter-chip-active" : ""}`}
                aria-pressed={value === category}
                on:click={() => select(category)}
            >
                {#if value === category}
                    <Check size={12} />
                {/if}
                {category}
            </button>
        {/each}

        {#if isCustom}
            <span class="filter-chip filter-chip-active">
                <Check size={12} />
                {value}
            </span>
        {/if}

        <button type="button" class="filter-chip" on:click={() => (showAll = true)}>
            <Tag size={12} />
            ดูทั้งหมด
        </button>
    </div>

    <input type="hidden" name="category" {value} />
</div>

<Sheet open={showAll} title="เลือกหมวดหมู่" on:close={() => (showAll = false)}>
    <div class="relative mb-3">
        <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
            <Search size={15} />
        </span>
        <input
            type="search"
            class="field-input pl-9"
            placeholder="ค้นหาหมวดหมู่"
            data-autofocus
            bind:value={search}
        />
    </div>

    <div class="max-h-[50vh] space-y-1 overflow-y-auto">
        {#each filtered as category (category)}
            <button
                type="button"
                class={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm transition-colors ${
                    value === category
                        ? "bg-accent-soft font-semibold text-accent-on-soft"
                        : "text-soft hover:bg-surface-muted"
                }`}
                on:click={() => select(category)}
            >
                {category}
                {#if value === category}
                    <Check size={16} />
                {/if}
            </button>
        {:else}
            <p class="px-3 py-6 text-center text-sm text-muted">ไม่พบหมวดหมู่ที่ค้นหา</p>
        {/each}
    </div>

    <div class="mt-3 border-t border-border pt-3">
        <label class="field-label" for="custom-category">หรือพิมพ์หมวดหมู่เอง</label>
        <div class="flex gap-2">
            <input
                id="custom-category"
                type="text"
                class="field-input"
                placeholder="หมวดหมู่ที่ต้องการใช้"
                bind:value={search}
            />
            <button
                type="button"
                class="btn-primary shrink-0 px-4"
                disabled={!search.trim()}
                on:click={() => select(search.trim())}
            >
                ใช้
            </button>
        </div>
    </div>
</Sheet>
