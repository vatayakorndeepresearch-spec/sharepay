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
    <header class="flex items-start justify-between gap-4 px-1">
        <div>
            <p class="eyebrow">History</p>
            <h1 class="text-3xl font-black text-slate-900 font-display tracking-tight">รายการทั้งหมด</h1>
            <p class="mt-1 text-sm text-slate-500">ดูย้อนหลังตามวัน แล้วค่อยเปิดรายการที่ต้องจัดการต่อ</p>
        </div>
        <button
            type="button"
            class="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600"
            aria-label="Open advanced filters"
            on:click={() => (showAdvancedFilters = true)}
        >
            <SlidersHorizontal size={18} />
        </button>
    </header>

    <section class="surface-card-soft p-5">
        <div class="mb-4 flex items-center justify-between gap-3">
            <div>
                <div class="text-sm font-semibold text-slate-900">
                    {data.summaryTotals.filteredCount} รายการ
                </div>
                <p class="text-sm text-slate-500">
                    รวมยอดในมุมมองนี้ {formatCurrency(data.summaryTotals.filteredAmount)}
                </p>
            </div>
            <div class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                {selectedProjectName}
            </div>
        </div>

        <div class="flex flex-wrap gap-2">
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
                ยังไม่เคลียร์
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
        <section class="surface-card p-8 text-center">
            <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 text-slate-400">
                <Receipt size={26} />
            </div>
            <h2 class="text-xl font-black text-slate-900 font-display">ไม่พบรายการในมุมมองนี้</h2>
            <p class="mt-2 text-sm text-slate-500">
                ลองเปลี่ยน filter หรือเริ่มบันทึกรายการใหม่จากปุ่มบันทึกด้านล่าง
            </p>
            <a href="/expenses/new" class="mt-5 inline-flex rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white">
                บันทึกรายการใหม่
            </a>
        </section>
    {:else}
        <section class="space-y-5">
            {#each dateGroups as group}
                <div class="space-y-3">
                    <div class="flex items-center gap-2 px-1 text-sm font-semibold text-slate-500">
                        <CalendarDays size={15} />
                        {group.label}
                    </div>

                    <div class="grid gap-3">
                        {#each group.items as expense}
                            <a href={`/expenses/${expense.id}`} class="surface-card flex items-center justify-between gap-4 p-4">
                                <div class="flex min-w-0 items-start gap-3">
                                    <div
                                        class={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                                            expense.transaction_type === "income"
                                                ? "bg-emerald-50 text-emerald-600"
                                                : "bg-slate-100 text-slate-700"
                                        }`}
                                    >
                                        {#if expense.transaction_type === "income"}
                                            <TrendingUp size={18} />
                                        {:else}
                                            <TrendingDown size={18} />
                                        {/if}
                                    </div>

                                    <div class="min-w-0">
                                        <div class="truncate text-sm font-bold text-slate-900">{expense.description}</div>
                                        <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                                            <span>{formatDate(expense.paid_at)}</span>
                                            <span>•</span>
                                            <span>{expense.profiles?.display_name || "ไม่ระบุผู้จ่าย"}</span>
                                            <span>•</span>
                                            <span>{expense.projects?.name}</span>
                                        </div>
                                        {#if expense.transaction_type === "expense"}
                                            <div class="mt-2">
                                                <span
                                                    class={`status-chip ${
                                                        expense.is_reimbursed
                                                            ? "bg-emerald-50 text-emerald-700"
                                                            : "bg-amber-50 text-amber-700"
                                                    }`}
                                                >
                                                    <CheckCircle2 size={12} />
                                                    {expense.is_reimbursed ? "เคลียร์แล้ว" : "ยังไม่เคลียร์"}
                                                </span>
                                            </div>
                                        {/if}
                                    </div>
                                </div>

                                <div class="shrink-0 text-right">
                                    <div
                                        class={`text-base font-black font-display ${
                                            expense.transaction_type === "income" ? "text-emerald-600" : "text-slate-900"
                                        }`}
                                    >
                                        {expense.transaction_type === "income" ? "+" : ""}{formatCurrency(expense.amount)}
                                    </div>
                                    <div class="mt-2 flex items-center justify-end gap-1 text-xs font-semibold text-slate-400">
                                        เปิดดู
                                        <ChevronRight size={14} />
                                    </div>
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
        class="fixed inset-0 z-[60] bg-slate-950/35 backdrop-blur-sm"
        aria-label="Close advanced filters"
        on:click={() => (showAdvancedFilters = false)}
        in:fade
        out:fade
    ></button>

    <div class="sheet-panel max-w-md mx-auto" in:fly={{ y: 20, duration: 160 }} out:fly={{ y: 20, duration: 120 }}>
        <div class="mb-5 flex items-center justify-between">
            <div>
                <p class="eyebrow">Advanced filters</p>
                <h2 class="text-xl font-black text-slate-900 font-display">กรองรายการ</h2>
            </div>
            <button
                type="button"
                class="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-500"
                aria-label="Close advanced filters"
                on:click={() => (showAdvancedFilters = false)}
            >
                <X size={18} />
            </button>
        </div>

        <div class="space-y-4">
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
                class="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-rose-600"
                on:click={() => {
                    showAdvancedFilters = false;
                    goto("/expenses");
                }}
            >
                <Funnel size={15} />
                ล้างตัวกรองทั้งหมด
            </button>
        </div>
    </div>
{/if}
