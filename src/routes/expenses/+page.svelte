<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { formatCurrency } from "$lib/utils/formatCurrency";
    import { formatDate } from "$lib/utils/formatDate";
    import {
        CalendarDays,
        CheckCircle2,
        ChevronRight,
        Funnel,
        Receipt,
        SlidersHorizontal,
        TrendingDown,
        TrendingUp,
        X,
    } from "lucide-svelte";
    import { fade, fly } from "svelte/transition";

    export let data;

    let showAdvancedFilters = false;

    type ExpenseRecord = (typeof data.expenses)[number];

    function updateQuery(next: Record<string, string>) {
        const query = new URLSearchParams($page.url.searchParams);

        Object.entries(next).forEach(([key, value]) => {
            if (!value || value === "all") {
                query.delete(key);
            } else {
                query.set(key, value);
            }
        });

        goto(query.size ? `?${query.toString()}` : "/expenses");
    }

    function applyQuickFilter(mode: "all" | "unpaid" | "paid" | "income" | "expense") {
        if (mode === "all") {
            updateQuery({ status: "all", type: "all" });
            return;
        }

        if (mode === "unpaid" || mode === "paid") {
            updateQuery({ status: mode, type: "expense" });
            return;
        }

        updateQuery({ status: "all", type: mode });
    }

    function getQuickMode(filters: typeof data.filters) {
        if (filters.status === "unpaid" && filters.type === "expense") return "unpaid";
        if (filters.status === "paid" && filters.type === "expense") return "paid";
        if (filters.type === "income") return "income";
        if (filters.type === "expense" && filters.status === "all") return "expense";
        return "all";
    }

    function groupedExpenses(expenses: ExpenseRecord[]) {
        const groups = new Map<string, ExpenseRecord[]>();
        for (const expense of expenses) {
            const key = expense.paid_at;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)?.push(expense);
        }

        return Array.from(groups.entries()).map(([date, items]) => ({
            date,
            label: new Date(date).toLocaleDateString("th-TH", {
                weekday: "short",
                day: "numeric",
                month: "long",
                year: "numeric",
            }),
            items,
        }));
    }

    $: activeQuickMode = getQuickMode(data.filters);
    $: dateGroups = groupedExpenses(data.expenses);
    $: selectedProjectName =
        data.filters.project === "all"
            ? "ทุกโปรเจค"
            : data.projects.find((project) => project.id === data.filters.project)?.name || "ทุกโปรเจค";
</script>

<div class="page-shell">
    <header class="flex items-center justify-between px-1">
        <h1 class="text-2xl font-bold text-slate-900 font-display">รายการทั้งหมด</h1>
        <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500"
            aria-label="Open advanced filters"
            on:click={() => (showAdvancedFilters = true)}
        >
            <SlidersHorizontal size={16} />
        </button>
    </header>

    <section class="surface-card p-4">
        <div class="mb-3 flex items-center justify-between">
            <div class="text-sm text-slate-600">
                <span class="font-semibold">{data.summaryTotals.filteredCount}</span> รายการ · {formatCurrency(data.summaryTotals.filteredAmount)}
            </div>
            <span class="text-xs font-medium text-slate-400">{selectedProjectName}</span>
        </div>

        <div class="flex flex-wrap gap-1.5">
            <button
                type="button"
                class={`filter-chip ${activeQuickMode === "all" ? "filter-chip-active" : ""}`}
                on:click={() => applyQuickFilter("all")}
            >
                ทั้งหมด
                <span class="text-xs text-slate-400">{data.summaryCounts.all}</span>
            </button>
            <button
                type="button"
                class={`filter-chip ${activeQuickMode === "unpaid" ? "filter-chip-active" : ""}`}
                on:click={() => applyQuickFilter("unpaid")}
            >
                ค้าง
                <span class="text-xs text-slate-400">{data.summaryCounts.unpaid}</span>
            </button>
            <button
                type="button"
                class={`filter-chip ${activeQuickMode === "paid" ? "filter-chip-active" : ""}`}
                on:click={() => applyQuickFilter("paid")}
            >
                เคลียร์แล้ว
                <span class="text-xs text-slate-400">{data.summaryCounts.paid}</span>
            </button>
            <button
                type="button"
                class={`filter-chip ${activeQuickMode === "income" ? "filter-chip-active" : ""}`}
                on:click={() => applyQuickFilter("income")}
            >
                รายรับ
                <span class="text-xs text-slate-400">{data.summaryCounts.income}</span>
            </button>
            <button
                type="button"
                class={`filter-chip ${activeQuickMode === "expense" ? "filter-chip-active" : ""}`}
                on:click={() => applyQuickFilter("expense")}
            >
                รายจ่าย
                <span class="text-xs text-slate-400">{data.summaryCounts.expense}</span>
            </button>
        </div>
    </section>

    {#if data.expenses.length === 0}
        <section class="surface-card p-6 text-center">
            <div class="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                <Receipt size={22} />
            </div>
            <h2 class="text-base font-bold text-slate-900">ไม่พบรายการ</h2>
            <p class="mt-1 text-sm text-slate-500">ลองเปลี่ยน filter หรือบันทึกรายการใหม่</p>
            <a href="/expenses/new" class="mt-3 inline-flex rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white">
                บันทึกรายการใหม่
            </a>
        </section>
    {:else}
        <section class="space-y-4">
            {#each dateGroups as group}
                <div class="space-y-2">
                    <div class="flex items-center gap-1.5 px-1 text-xs font-medium text-slate-400">
                        <CalendarDays size={13} />
                        {group.label}
                    </div>

                    <div class="grid gap-2">
                        {#each group.items as expense}
                            <a href={`/expenses/${expense.id}`} class="surface-card flex items-center justify-between gap-3 p-3">
                                <div class="flex min-w-0 items-start gap-2.5">
                                    <div
                                        class={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                                            expense.transaction_type === "income"
                                                ? "bg-emerald-50 text-emerald-600"
                                                : "bg-slate-100 text-slate-600"
                                        }`}
                                    >
                                        {#if expense.transaction_type === "income"}
                                            <TrendingUp size={16} />
                                        {:else}
                                            <TrendingDown size={16} />
                                        {/if}
                                    </div>

                                    <div class="min-w-0">
                                        <div class="truncate text-sm font-medium text-slate-900">{expense.description}</div>
                                        <div class="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500">
                                            <span>{formatDate(expense.paid_at)}</span>
                                            <span class="text-slate-300">·</span>
                                            <span>{expense.profiles?.display_name || "ไม่ระบุ"}</span>
                                            <span class="text-slate-300">·</span>
                                            <span>{expense.projects?.name}</span>
                                        </div>
                                        {#if expense.transaction_type === "expense"}
                                            <div class="mt-1">
                                                <span
                                                    class={`status-chip ${
                                                        expense.is_reimbursed
                                                            ? "bg-emerald-50 text-emerald-700"
                                                            : "bg-amber-50 text-amber-700"
                                                    }`}
                                                >
                                                    <CheckCircle2 size={11} />
                                                    {expense.is_reimbursed ? "เคลียร์แล้ว" : "ค้าง"}
                                                </span>
                                            </div>
                                        {/if}
                                    </div>
                                </div>

                                <div class="shrink-0 text-right">
                                    <div
                                        class={`text-sm font-bold font-display ${
                                            expense.transaction_type === "income" ? "text-emerald-600" : "text-slate-900"
                                        }`}
                                    >
                                        {expense.transaction_type === "income" ? "+" : ""}{formatCurrency(expense.amount)}
                                    </div>
                                    <ChevronRight size={14} class="mt-1 ml-auto text-slate-300" />
                                </div>
                            </a>
                        {/each}
                    </div>
                </div>
            {/each}
        </section>
    {/if}
</div>

{#if showAdvancedFilters}
    <button
        type="button"
        class="fixed inset-0 z-[60] bg-black/30"
        aria-label="Close advanced filters"
        on:click={() => (showAdvancedFilters = false)}
        in:fade={{ duration: 150 }}
        out:fade={{ duration: 100 }}
    ></button>

    <div class="sheet-panel max-w-md mx-auto" in:fly={{ y: 20, duration: 150 }} out:fly={{ y: 20, duration: 100 }}>
        <div class="mb-4 flex items-center justify-between">
            <h2 class="text-lg font-bold text-slate-900">กรองรายการ</h2>
            <button
                type="button"
                class="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                aria-label="Close advanced filters"
                on:click={() => (showAdvancedFilters = false)}
            >
                <X size={18} />
            </button>
        </div>

        <div class="space-y-3">
            <div>
                <label class="field-label" for="project-filter">โปรเจค</label>
                <select
                    id="project-filter"
                    class="field-input"
                    value={data.filters.project}
                    on:change={(event) =>
                        updateQuery({ project: (event.currentTarget as HTMLSelectElement).value })}
                >
                    <option value="all">ทุกโปรเจค</option>
                    {#each data.projects as project}
                        <option value={project.id}>{project.name}</option>
                    {/each}
                </select>
            </div>

            <div>
                <label class="field-label" for="type-filter">ประเภท</label>
                <select
                    id="type-filter"
                    class="field-input"
                    value={data.filters.type}
                    on:change={(event) =>
                        updateQuery({ type: (event.currentTarget as HTMLSelectElement).value })}
                >
                    <option value="all">ทั้งหมด</option>
                    <option value="expense">รายจ่าย</option>
                    <option value="income">รายรับ</option>
                </select>
            </div>

            <div>
                <label class="field-label" for="status-filter">สถานะ</label>
                <select
                    id="status-filter"
                    class="field-input"
                    value={data.filters.status}
                    on:change={(event) =>
                        updateQuery({ status: (event.currentTarget as HTMLSelectElement).value })}
                >
                    <option value="all">ทั้งหมด</option>
                    <option value="unpaid">ยังไม่เคลียร์</option>
                    <option value="paid">เคลียร์แล้ว</option>
                </select>
            </div>

            <button
                type="button"
                class="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-rose-600"
                on:click={() => {
                    showAdvancedFilters = false;
                    goto("/expenses");
                }}
            >
                <Funnel size={14} />
                ล้างตัวกรองทั้งหมด
            </button>
        </div>
    </div>
{/if}
