<script lang="ts">
    import { formatCurrency } from "$lib/utils/formatCurrency";
    import { formatDate } from "$lib/utils/formatDate";
    import {
        ArrowRight,
        Briefcase,
        CheckCircle2,
        Clock3,
        Receipt,
        TrendingDown,
        TrendingUp,
    } from "lucide-svelte";

    export let data;

    $: settlementSummary = data.settlementSummary;
    $: projectCards = Object.values(data.projectSummary || {});
</script>

<div class="page-shell">
    <header class="px-1">
        <h1 class="text-2xl font-bold text-slate-900 font-display">
            {data.currentUser?.name ? `สวัสดี ${data.currentUser.name.split(" ")[0]}` : "SharePay"}
        </h1>
    </header>

    <section class="surface-card bg-indigo-600 border-indigo-600 p-5 text-white">
        <div class="flex items-center gap-1.5 text-xs font-medium text-indigo-200 mb-3">
            <Clock3 size={12} />
            สถานะตอนนี้
        </div>


        {#if settlementSummary.amount > 0}
            <div class="mt-4 rounded-xl bg-white/10 px-4 py-3">
                <p class="text-xs text-indigo-200">ยอดที่ต้องจัดการ</p>
                <div class="mt-0.5 text-2xl font-bold font-display">
                    {formatCurrency(settlementSummary.amount)}
                </div>
            </div>
        {:else}
            <div class="mt-4 flex items-center gap-2 rounded-xl bg-emerald-500/20 px-4 py-3 text-emerald-100">
                <CheckCircle2 size={18} />
                <span class="text-sm font-medium">ไม่มีรายการค้าง</span>
            </div>
        {/if}

        <a
            href={settlementSummary.ctaHref}
            class="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 transition-colors"
        >
            {settlementSummary.ctaLabel}
            <ArrowRight size={14} />
        </a>
    </section>

    <section class="space-y-2">
        <h2 class="text-base font-bold text-slate-900 px-1">ภาพรวมโปรเจค</h2>

        <div class="grid gap-2">
            {#each projectCards as project}
                <div class="surface-card p-4">
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center gap-2.5">
                            <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                                <Briefcase size={16} />
                            </div>
                            <span class="text-sm font-semibold text-slate-900">{project.name}</span>
                        </div>
                        <span class="text-xs font-medium text-slate-400">ใช้งานอยู่</span>
                    </div>

                    <div class="grid grid-cols-2 gap-2">
                        <div class="rounded-lg bg-emerald-50 px-3 py-2">
                            <div class="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                                <TrendingUp size={13} />
                                รายรับ
                            </div>
                            <div class="mt-0.5 text-base font-bold text-emerald-700 font-display">
                                {formatCurrency(project.income)}
                            </div>
                        </div>
                        <div class="rounded-lg bg-slate-50 px-3 py-2">
                            <div class="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                                <TrendingDown size={13} />
                                รายจ่าย
                            </div>
                            <div class="mt-0.5 text-base font-bold text-slate-900 font-display">
                                {formatCurrency(project.expense)}
                            </div>
                        </div>
                    </div>
                </div>
            {/each}
        </div>
    </section>

    <section class="space-y-2">
        <div class="flex items-center justify-between px-1">
            <h2 class="text-base font-bold text-slate-900">รายการล่าสุด</h2>
            <a href="/expenses" class="text-sm font-medium text-indigo-600">ดูทั้งหมด</a>
        </div>

        {#if data.expenses.length === 0}
            <div class="surface-card p-6 text-center">
                <div class="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                    <Receipt size={22} />
                </div>
                <h3 class="text-base font-bold text-slate-900">ยังไม่มีรายการ</h3>
                <p class="mt-1 text-sm text-slate-500">เริ่มบันทึกรายการแรกเพื่อให้ dashboard มีข้อมูล</p>
                <a href="/expenses/new" class="mt-4 inline-flex rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
                    บันทึกรายการใหม่
                </a>
            </div>
        {:else}
            <div class="grid gap-2">
                {#each data.expenses as expense}
                    <a href={`/expenses/${expense.id}`} class="surface-card flex items-center justify-between gap-3 p-3">
                        <div class="flex min-w-0 items-center gap-2.5">
                            <div
                                class={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
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
                                <div class="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                                    <span>{formatDate(expense.paid_at)}</span>
                                    <span class="text-slate-300">·</span>
                                    <span>{expense.profiles?.display_name || "ไม่ระบุ"}</span>
                                    {#if expense.transaction_type === "expense"}
                                        <span
                                            class={`status-chip ${
                                                expense.is_reimbursed
                                                    ? "bg-emerald-50 text-emerald-700"
                                                    : "bg-amber-50 text-amber-700"
                                            }`}
                                        >
                                            {expense.is_reimbursed ? "เคลียร์แล้ว" : "ค้าง"}
                                        </span>
                                    {/if}
                                </div>
                            </div>
                        </div>
                        <div class="shrink-0 text-right">
                            <div
                                class={`text-sm font-bold font-display ${
                                    expense.transaction_type === "income"
                                        ? "text-emerald-600"
                                        : "text-slate-900"
                                }`}
                            >
                                {expense.transaction_type === "income" ? "+" : ""}{formatCurrency(expense.amount)}
                            </div>
                        </div>
                    </a>
                {/each}
            </div>
        {/if}
    </section>
</div>
