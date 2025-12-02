<script lang="ts">
    import { formatCurrency } from "$lib/utils/formatCurrency";
    import { formatDate } from "$lib/utils/formatDate";
    import {
        FileText,
        CheckCircle,
        XCircle,
        Wallet,
        ArrowRight,
    } from "lucide-svelte";

    export let data;
    $: ({ expenses, projectSummary, netBalance } = data);
</script>

<div class="space-y-8 pb-12">
    <!-- Hero: Net Balance -->
    <div
        class="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden"
    >
        <!-- Background Pattern -->
        <div
            class="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/10 rounded-full blur-3xl"
        ></div>
        <div
            class="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-black/10 rounded-full blur-3xl"
        ></div>

        <div class="relative z-10 text-center">
            <h2
                class="text-indigo-100 text-sm font-medium mb-2 uppercase tracking-wider"
            >
                ยอดสุทธิที่ต้องเคลียร์
            </h2>

            {#if netBalance.amount > 0}
                <div class="flex flex-col items-center gap-2 mb-4">
                    <div class="text-4xl font-bold tracking-tight">
                        {formatCurrency(netBalance.amount)}
                    </div>
                    <div
                        class="flex items-center gap-3 text-lg bg-white/20 px-4 py-1.5 rounded-full backdrop-blur-sm"
                    >
                        <span class="font-bold">{netBalance.debtor}</span>
                        <ArrowRight size={18} class="opacity-70" />
                        <span class="font-bold">{netBalance.creditor}</span>
                    </div>
                </div>
                <p class="text-xs text-indigo-200 opacity-80">
                    (คำนวณจากส่วนต่างยอดจ่ายจริงของทั้งสองฝ่าย)
                </p>
            {:else}
                <div class="py-6">
                    <div class="text-3xl font-bold mb-2">
                        เคลียร์ครบแล้ว! 🎉
                    </div>
                    <p class="text-indigo-200">ไม่มีหนี้ค้างชำระต่อกัน</p>
                </div>
            {/if}
        </div>
    </div>

    <!-- Project Summary -->
    <div>
        <h3
            class="text-lg font-bold text-gray-800 mb-4 px-2 flex items-center gap-2"
        >
            <Wallet size={20} class="text-indigo-600" /> ภาพรวมโปรเจค
        </h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {#each Object.values(projectSummary) as project}
                <div
                    class="bg-white rounded-2xl shadow-sm p-5 border border-gray-100"
                >
                    <h3
                        class="font-bold text-gray-800 mb-3 flex items-center gap-2"
                    >
                        <span class="w-2 h-6 bg-indigo-500 rounded-full"></span>
                        {project.name}
                    </h3>
                    <div class="space-y-2">
                        <div class="flex justify-between items-center text-sm">
                            <span class="text-gray-500">รายรับ</span>
                            <span class="font-bold text-green-600"
                                >+{formatCurrency(project.income)}</span
                            >
                        </div>
                        <div class="flex justify-between items-center text-sm">
                            <span class="text-gray-500">รายจ่าย</span>
                            <span class="font-bold text-red-600"
                                >-{formatCurrency(project.expense)}</span
                            >
                        </div>
                        <div
                            class="pt-2 border-t border-gray-100 flex justify-between items-center font-medium"
                        >
                            <span class="text-gray-900">คงเหลือ</span>
                            <span
                                class={project.income - project.expense >= 0
                                    ? "text-green-600"
                                    : "text-red-600"}
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
    </div>

    <!-- Recent Expenses -->
    <div>
        <div class="flex justify-between items-center mb-4 px-2">
            <h3 class="text-lg font-bold text-gray-800">รายการล่าสุด</h3>
            <a
                href="/expenses"
                class="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                >ดูทั้งหมด</a
            >
        </div>

        <div
            class="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100"
        >
            {#if expenses.length === 0}
                <div class="p-8 text-center text-gray-500">ยังไม่มีรายการ</div>
            {:else}
                <div class="divide-y divide-gray-100">
                    {#each expenses as expense}
                        <a
                            href="/expenses/{expense.id}"
                            class="block p-4 hover:bg-gray-50 transition flex items-center justify-between"
                        >
                            <div class="flex items-center gap-4">
                                <!-- Icon/Avatar Placeholder -->
                                <div
                                    class="w-10 h-10 rounded-full flex items-center justify-center {expense.transaction_type ===
                                    'income'
                                        ? 'bg-green-100 text-green-600'
                                        : 'bg-red-100 text-red-600'}"
                                >
                                    {#if expense.transaction_type === "income"}
                                        <ArrowRight
                                            size={20}
                                            class="rotate-45"
                                        />
                                    {:else}
                                        <ArrowRight
                                            size={20}
                                            class="-rotate-45"
                                        />
                                    {/if}
                                </div>

                                <div>
                                    <div
                                        class="font-bold text-gray-900 text-sm"
                                    >
                                        {expense.description}
                                    </div>
                                    <div
                                        class="text-xs text-gray-500 flex items-center gap-2 mt-0.5"
                                    >
                                        <span
                                            >{formatDate(expense.paid_at)}</span
                                        >
                                        <span>•</span>
                                        <span
                                            >{expense.profiles
                                                ?.display_name}</span
                                        >
                                    </div>
                                </div>
                            </div>

                            <div class="text-right">
                                <div
                                    class="font-bold {expense.transaction_type ===
                                    'income'
                                        ? 'text-green-600'
                                        : 'text-gray-900'} {expense.is_reimbursed
                                        ? 'line-through opacity-50'
                                        : ''}"
                                >
                                    {expense.transaction_type === "income"
                                        ? "+"
                                        : ""}{formatCurrency(expense.amount)}
                                </div>
                                {#if expense.is_reimbursed}
                                    <div
                                        class="text-[10px] text-green-600 font-medium mt-0.5 flex items-center justify-end gap-1"
                                    >
                                        <CheckCircle size={10} /> เคลียร์แล้ว
                                    </div>
                                {/if}
                            </div>
                        </a>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
</div>
