<script lang="ts">
    import { formatCurrency } from "$lib/utils/formatCurrency";
    import { formatDate } from "$lib/utils/formatDate";
    import {
        ArrowRight,
        CreditCard,
        TrendingUp,
        TrendingDown,
        CheckCircle2,
        ChevronRight,
        Briefcase,
    } from "lucide-svelte";

    export let data;
    $: ({ expenses, projectSummary, netBalance } = data);
</script>

<div class="space-y-10 pb-12">
    <!-- Header -->
    <header class="flex justify-between items-center px-1">
        <div>
            <h1
                class="text-3xl font-black tracking-tight text-slate-900 font-display"
            >
                SharePay
            </h1>
            <p class="text-slate-500 text-sm font-medium">
                จัดการค่าใช้จ่ายร่วมกันแบบโปร
            </p>
        </div>
        <div
            class="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600"
        >
            <Briefcase size={20} />
        </div>
    </header>

    <!-- Hero: Net Balance Card -->
    <div
        class="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 rounded-[32px] p-8 text-white shadow-2xl shadow-indigo-200 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-500"
    >
        <!-- Background Decorative Elements -->
        <div
            class="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-white/10 rounded-full blur-[80px] group-hover:bg-white/20 transition-colors duration-500"
        ></div>
        <div
            class="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-purple-400/20 rounded-full blur-[60px]"
        ></div>

        <div class="relative z-10">
            <div class="flex items-center gap-2 mb-6">
                <div
                    class="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-widest"
                >
                    Settlement Status
                </div>
            </div>

            {#if netBalance.amount > 0}
                <div class="space-y-4">
                    <div class="text-sm font-medium text-indigo-100/80">
                        ยอดสุทธิที่ต้องเคลียร์
                    </div>
                    <div
                        class="text-5xl font-black tracking-tighter font-display"
                    >
                        {formatCurrency(netBalance.amount)}
                    </div>

                    <div class="flex items-center gap-3 pt-2">
                        <div
                            class="flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 transition-colors"
                        >
                            <span class="text-xs font-bold text-indigo-100"
                                >{netBalance.debtor}</span
                            >
                            <ArrowRight size={14} class="text-white/60" />
                            <span class="text-xs font-bold"
                                >{netBalance.creditor}</span
                            >
                        </div>
                    </div>
                </div>
            {:else}
                <div class="py-4">
                    <div class="flex items-center gap-3 mb-2">
                        <div
                            class="w-12 h-12 bg-emerald-400/20 rounded-2xl flex items-center justify-center"
                        >
                            <CheckCircle2 size={32} class="text-emerald-400" />
                        </div>
                        <div>
                            <div
                                class="text-2xl font-bold font-display leading-tight"
                            >
                                เคลียร์ครบแล้ว! 🎉
                            </div>
                            <p class="text-indigo-100/70 text-sm">
                                ไม่มีหนี้ค้างชำระต่อกันในขณะนี้
                            </p>
                        </div>
                    </div>
                </div>
            {/if}
        </div>
    </div>

    <!-- Project Summary Grid -->
    <section>
        <div class="flex items-center justify-between mb-5 px-1">
            <h3
                class="text-lg font-bold text-slate-800 font-display flex items-center gap-2"
            >
                <CreditCard size={18} class="text-indigo-600" />
                ภาพรวมโปรเจค
            </h3>
        </div>

        <div class="grid grid-cols-1 gap-4">
            {#each Object.values(projectSummary) as project}
                <div
                    class="bg-white rounded-[24px] p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
                >
                    <div
                        class="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 group-hover:bg-indigo-50 transition-colors"
                    ></div>

                    <div class="relative">
                        <div class="flex justify-between items-start mb-6">
                            <div class="flex items-center gap-3">
                                <div
                                    class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors"
                                >
                                    <Briefcase size={20} />
                                </div>
                                <h4 class="font-bold text-slate-900">
                                    {project.name}
                                </h4>
                            </div>
                            <div
                                class="px-2 py-1 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-500 uppercase tracking-wider"
                            >
                                Active
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div class="space-y-1">
                                <span
                                    class="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"
                                >
                                    <TrendingUp
                                        size={10}
                                        class="text-emerald-500"
                                    /> Income
                                </span>
                                <div
                                    class="text-lg font-bold text-slate-900 tracking-tight"
                                >
                                    {formatCurrency(project.income)}
                                </div>
                            </div>
                            <div class="space-y-1">
                                <span
                                    class="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"
                                >
                                    <TrendingDown
                                        size={10}
                                        class="text-rose-500"
                                    /> Expense
                                </span>
                                <div
                                    class="text-lg font-bold text-slate-900 tracking-tight"
                                >
                                    {formatCurrency(project.expense)}
                                </div>
                            </div>
                        </div>

                        <div
                            class="mt-6 pt-5 border-t border-dashed border-slate-100 flex items-center justify-between"
                        >
                            <span
                                class="text-xs font-medium text-slate-500 text-slate-500"
                                >ยอดคงเหลือ</span
                            >
                            <span
                                class="text-lg font-black font-display {project.income -
                                    project.expense >=
                                0
                                    ? 'text-indigo-600'
                                    : 'text-rose-600'}"
                            >
                                {formatCurrency(
                                    project.income - project.expense,
                                )}
                            </span>
                        </div>
                    </div>
                </div>
            {/each}
        </div>
    </section>

    <!-- Recent Activity -->
    <section>
        <div class="flex justify-between items-center mb-5 px-1">
            <h3 class="text-lg font-bold text-slate-800 font-display">
                รายการล่าสุด
            </h3>
            <a
                href="/expenses"
                class="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-xl transition-colors"
                >ดูทั้งหมด</a
            >
        </div>

        <div class="space-y-3">
            {#if expenses.length === 0}
                <div
                    class="bg-white border border-dashed border-slate-200 rounded-3xl p-10 text-center text-slate-400 text-sm font-medium"
                >
                    ยังไม่มีรายการในขณะนี้
                </div>
            {:else}
                {#each expenses as expense}
                    <a
                        href="/expenses/{expense.id}"
                        class="group bg-white rounded-3xl p-4 border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all flex items-center justify-between"
                    >
                        <div class="flex items-center gap-4">
                            <div
                                class="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors {expense.transaction_type ===
                                'income'
                                    ? 'bg-emerald-50 text-emerald-600'
                                    : 'bg-slate-50 text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-600'}"
                            >
                                {#if expense.transaction_type === "income"}
                                    <TrendingUp size={22} />
                                {:else}
                                    <TrendingDown size={22} />
                                {/if}
                            </div>

                            <div class="min-w-0">
                                <div
                                    class="font-bold text-slate-900 text-sm truncate group-hover:text-indigo-600 transition-colors"
                                >
                                    {expense.description}
                                </div>
                                <div
                                    class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-2"
                                >
                                    <span>{formatDate(expense.paid_at)}</span>
                                    <span>•</span>
                                    <span class="text-slate-600"
                                        >{expense.profiles?.display_name}</span
                                    >
                                </div>
                            </div>
                        </div>

                        <div class="text-right shrink-0">
                            <div
                                class="font-black font-display text-sm tracking-tight {expense.transaction_type ===
                                'income'
                                    ? 'text-emerald-600'
                                    : 'text-slate-900'} {expense.is_reimbursed
                                    ? 'line-through opacity-30 italic'
                                    : ''}"
                            >
                                {expense.transaction_type === "income"
                                    ? "+"
                                    : ""}{formatCurrency(expense.amount)}
                            </div>

                            {#if expense.is_reimbursed}
                                <div
                                    class="text-[9px] text-emerald-600 font-black uppercase tracking-widest mt-1 flex items-center justify-end gap-1"
                                >
                                    <CheckCircle2 size={10} /> Cleared
                                </div>
                            {/if}

                            <div
                                class="flex justify-end mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <ChevronRight
                                    size={14}
                                    class="text-indigo-400"
                                />
                            </div>
                        </div>
                    </a>
                {/each}
            {/if}
        </div>
    </section>
</div>
