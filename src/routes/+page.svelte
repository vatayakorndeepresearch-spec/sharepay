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
        WalletCards,
    } from "lucide-svelte";

    export let data;

    $: settlementSummary = data.settlementSummary;
    $: projectCards = Object.values(data.projectSummary || {});
</script>

<div class="page-shell">
    <header class="flex items-start justify-between gap-4 px-1">
        <div>
            <p class="eyebrow">Action center</p>
            <h1 class="text-3xl font-black tracking-tight text-slate-900 font-display">
                {data.currentUser?.name ? `สวัสดี ${data.currentUser.name.split(" ")[0]}` : "SharePay"}
            </h1>
            <p class="mt-1 text-sm text-slate-500">
                รู้ยอดค้างก่อน แล้วค่อยตัดสินใจว่าควรเคลียร์หรือบันทึกรายการต่อ
            </p>
        </div>
        <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <WalletCards size={20} />
        </div>
    </header>

    <section class="overflow-hidden rounded-[32px] bg-gradient-to-br from-indigo-600 to-indigo-800 p-7 text-white premium-shadow">
        <div class="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold">
            <Clock3 size={13} />
            สถานะตอนนี้
        </div>

        <div class="space-y-4">
            <div>
                <h2 class="text-3xl font-black font-display tracking-tight">
                    {settlementSummary.headline}
                </h2>
                <p class="mt-2 max-w-[28ch] text-sm text-indigo-100/85">
                    {settlementSummary.subline}
                </p>
            </div>

            {#if settlementSummary.amount > 0}
                <div class="rounded-[28px] bg-white/12 px-5 py-4 backdrop-blur-sm">
                    <p class="text-sm text-indigo-100/80">ยอดที่ต้องจัดการ</p>
                    <div class="mt-1 text-4xl font-black font-display tracking-tight">
                        {formatCurrency(settlementSummary.amount)}
                    </div>
                </div>
            {:else}
                <div class="flex items-center gap-3 rounded-[28px] bg-emerald-400/12 px-5 py-4 text-emerald-100">
                    <CheckCircle2 size={24} />
                    <span class="text-sm font-semibold">ยังไม่มีรายการค้างที่ต้องเคลียร์</span>
                </div>
            {/if}

            <a
                href={settlementSummary.ctaHref}
                class="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-indigo-700 transition hover:bg-indigo-50"
            >
                {settlementSummary.ctaLabel}
                <ArrowRight size={16} />
            </a>
        </div>
    </section>

    <section class="space-y-3">
        <div class="flex items-center justify-between px-1">
            <div>
                <h2 class="text-lg font-black text-slate-900 font-display">ภาพรวมโปรเจค</h2>
                <p class="text-sm text-slate-500">ดูยอดเข้าออกแบบสั้น ๆ ก่อนลงไปดูรายการ</p>
            </div>
        </div>

        <div class="grid gap-3">
            {#each projectCards as project}
                <div class="surface-card p-5">
                    <div class="mb-4 flex items-start justify-between gap-3">
                        <div class="flex items-center gap-3">
                            <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                                <Briefcase size={18} />
                            </div>
                            <div>
                                <div class="text-base font-bold text-slate-900">{project.name}</div>
                                <div class="text-sm text-slate-500">ยอดรวมของโปรเจคนี้</div>
                            </div>
                        </div>
                        <div class="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500">
                            ใช้งานอยู่
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div class="rounded-2xl bg-emerald-50 px-4 py-3">
                            <div class="mb-1 flex items-center gap-2 text-sm font-semibold text-emerald-700">
                                <TrendingUp size={15} />
                                รายรับ
                            </div>
                            <div class="text-lg font-black text-emerald-700 font-display">
                                {formatCurrency(project.income)}
                            </div>
                        </div>
                        <div class="rounded-2xl bg-slate-50 px-4 py-3">
                            <div class="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-600">
                                <TrendingDown size={15} />
                                รายจ่าย
                            </div>
                            <div class="text-lg font-black text-slate-900 font-display">
                                {formatCurrency(project.expense)}
                            </div>
                        </div>
                    </div>
                </div>
            {/each}
        </div>
    </section>

    <section class="space-y-3">
        <div class="flex items-center justify-between px-1">
            <div>
                <h2 class="text-lg font-black text-slate-900 font-display">รายการล่าสุด</h2>
                <p class="text-sm text-slate-500">เช็กจำนวนเงิน คนจ่าย และสถานะได้ในแถวเดียว</p>
            </div>
            <a href="/expenses" class="text-sm font-semibold text-indigo-600">ดูทั้งหมด</a>
        </div>

        {#if data.expenses.length === 0}
            <div class="surface-card p-8 text-center">
                <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 text-slate-400">
                    <Receipt size={26} />
                </div>
                <h3 class="text-lg font-bold text-slate-900">ยังไม่มีรายการ</h3>
                <p class="mt-2 text-sm text-slate-500">เริ่มจากบันทึกรายการแรกเพื่อให้ dashboard นี้มีข้อมูลใช้งาน</p>
                <a href="/expenses/new" class="mt-5 inline-flex rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white">
                    บันทึกรายการใหม่
                </a>
            </div>
        {:else}
            <div class="grid gap-3">
                {#each data.expenses as expense}
                    <a href={`/expenses/${expense.id}`} class="surface-card flex items-center justify-between gap-4 p-4">
                        <div class="flex min-w-0 items-center gap-3">
                            <div
                                class={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
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
                                    {#if expense.transaction_type === "expense"}
                                        <span
                                            class={`status-chip ${
                                                expense.is_reimbursed
                                                    ? "bg-emerald-50 text-emerald-700"
                                                    : "bg-amber-50 text-amber-700"
                                            }`}
                                        >
                                            {expense.is_reimbursed ? "เคลียร์แล้ว" : "ยังไม่เคลียร์"}
                                        </span>
                                    {/if}
                                </div>
                            </div>
                        </div>
                        <div class="shrink-0 text-right">
                            <div
                                class={`text-base font-black font-display ${
                                    expense.transaction_type === "income"
                                        ? "text-emerald-600"
                                        : "text-slate-900"
                                }`}
                            >
                                {expense.transaction_type === "income" ? "+" : ""}{formatCurrency(expense.amount)}
                            </div>
                            <div class="mt-1 text-xs font-semibold text-slate-400">เปิดดูรายละเอียด</div>
                        </div>
                    </a>
                {/each}
            </div>
        {/if}
    </section>
</div>
