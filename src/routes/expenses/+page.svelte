<script lang="ts">
    import { formatCurrency } from "$lib/utils/formatCurrency";
    import { formatDate } from "$lib/utils/formatDate";
    import {
        FileText,
        CheckCircle,
        XCircle,
        Filter,
        ScanLine,
        Plus,
        CirclePlus,
        ChevronRight,
        Calendar,
        Receipt,
        Banknote,
        Shapes,
        Sparkles,
    } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { fade, slide, fly, scale } from "svelte/transition";

    export let data;
    $: ({ expenses, projects, filters } = data);

    function handleFilterChange(event: Event) {
        const select = event.target as HTMLSelectElement;
        const id = select.id;
        const value = select.value;

        const query = new URLSearchParams($page.url.searchParams);
        query.set(id, value);
        goto(`?${query.toString()}`);
    }

    let showAddMenu = false;
    let menuRef: HTMLElement;

    function toggleMenu() {
        showAddMenu = !showAddMenu;
    }

    function closeMenu(event: MouseEvent) {
        if (menuRef && !menuRef.contains(event.target as Node)) {
            showAddMenu = false;
        }
    }
</script>

<svelte:window on:click={closeMenu} />

<div class="space-y-6 pb-20">
    <div class="flex justify-between items-end mb-4 px-1">
        <div>
            <h1
                class="text-3xl font-black text-slate-900 font-display tracking-tight"
            >
                รายการทั้งหมด
            </h1>
            <p
                class="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1"
            >
                ประวัติการทำรายการของคุณ
            </p>
        </div>

        <div class="relative" bind:this={menuRef}>
            <button
                on:click|stopPropagation={toggleMenu}
                class="bg-indigo-600 text-white px-5 py-3 rounded-2xl font-black font-display tracking-tight hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/20 text-sm flex items-center gap-2 active:scale-95"
            >
                <Plus size={20} /> เพิ่มรายการ
            </button>

            {#if showAddMenu}
                <div
                    class="absolute right-0 mt-3 w-56 bg-white/90 backdrop-blur-xl rounded-[24px] shadow-2xl border border-slate-100 py-2 z-50 overflow-hidden"
                    in:fly={{ y: 10, duration: 200 }}
                    out:fade={{ duration: 150 }}
                >
                    <a
                        href="/expenses/new"
                        class="flex items-center gap-4 px-4 py-4 text-sm text-slate-700 hover:bg-indigo-50 transition-colors group"
                        on:click={() => (showAddMenu = false)}
                    >
                        <div
                            class="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors shadow-sm"
                        >
                            <Plus size={20} />
                        </div>
                        <div>
                            <div class="font-bold">รายการเดียว</div>
                            <div
                                class="text-[10px] text-slate-400 uppercase font-bold tracking-tight"
                            >
                                Manual Entry
                            </div>
                        </div>
                    </a>
                    <div class="mx-4 border-t border-slate-50"></div>
                    <a
                        href="/expenses/bulk"
                        class="flex items-center gap-4 px-4 py-4 text-sm text-slate-700 hover:bg-emerald-50 transition-colors group"
                        on:click={() => (showAddMenu = false)}
                    >
                        <div
                            class="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors shadow-sm"
                        >
                            <Sparkles size={18} />
                        </div>
                        <div>
                            <div class="font-bold">หลายรายการ</div>
                            <div
                                class="text-[10px] text-slate-400 uppercase font-bold tracking-tight"
                            >
                                AI Slip Scan
                            </div>
                        </div>
                    </a>
                </div>
            {/if}
        </div>
    </div>

    <!-- Filters -->
    <div
        class="bg-white/70 backdrop-blur-md p-5 rounded-[28px] border border-white shadow-sm space-y-4 premium-shadow"
    >
        <div
            class="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-widest px-1"
        >
            <Filter size={14} class="text-indigo-600" /> ตัวกรองข้อมูล
        </div>
        <div class="grid grid-cols-3 gap-4">
            <div class="space-y-1.5">
                <label
                    for="type"
                    class="block text-[10px] font-bold text-slate-400 uppercase tracking-tighter px-1"
                    >ประเภท</label
                >
                <select
                    id="type"
                    value={filters.type}
                    on:change={handleFilterChange}
                    class="w-full text-xs font-bold bg-slate-50/50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500/20 py-3 px-3 appearance-none"
                >
                    <option value="all">ทั้งหมด</option>
                    <option value="income">รายรับ</option>
                    <option value="expense">รายจ่าย</option>
                </select>
            </div>
            <div class="space-y-1.5">
                <label
                    for="project"
                    class="block text-[10px] font-bold text-slate-400 uppercase tracking-tighter px-1"
                    >โปรเจค</label
                >
                <select
                    id="project"
                    value={filters.project}
                    on:change={handleFilterChange}
                    class="w-full text-xs font-bold bg-slate-50/50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500/20 py-3 px-3 appearance-none"
                >
                    <option value="all">ทั้งหมด</option>
                    {#each projects as project}
                        <option value={project.id}>{project.name}</option>
                    {/each}
                </select>
            </div>
            <div class="space-y-1.5">
                <label
                    for="status"
                    class="block text-[10px] font-bold text-slate-400 uppercase tracking-tighter px-1"
                    >สถานะ</label
                >
                <select
                    id="status"
                    value={filters.status}
                    on:change={handleFilterChange}
                    class="w-full text-xs font-bold bg-slate-50/50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500/20 py-3 px-3 appearance-none"
                >
                    <option value="all">ทั้งหมด</option>
                    <option value="unpaid">ยังไม่เคลียร์</option>
                    <option value="paid">เคลียร์แล้ว</option>
                </select>
            </div>
        </div>
    </div>

    <!-- List -->
    <div class="space-y-4">
        {#if expenses.length === 0}
            <div
                class="bg-white rounded-[32px] p-16 text-center premium-shadow border border-slate-100"
                in:fade
            >
                <div
                    class="w-20 h-20 bg-slate-50 rounded-[28px] flex items-center justify-center mx-auto mb-6 text-slate-300"
                >
                    <Receipt size={40} />
                </div>
                <h3 class="text-xl font-black text-slate-900 mb-2 font-display">
                    ไม่พบรายการ
                </h3>
                <p
                    class="text-slate-400 mb-8 max-w-[240px] mx-auto text-sm font-medium"
                >
                    ลองเปลี่ยนตัวกรอง หรือเริ่มบันทึกรายการใหม่กันเลย
                </p>
                <div class="flex flex-col gap-3 max-w-[200px] mx-auto">
                    <a
                        href="/expenses/new"
                        class="bg-indigo-600 text-white py-3.5 rounded-2xl font-black tracking-tight hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/20 active:scale-95 font-display text-sm"
                    >
                        บันทึกรายการใหม่
                    </a>
                </div>
            </div>
        {:else}
            <div class="grid gap-3">
                {#each expenses as expense, i}
                    <a
                        href="/expenses/{expense.id}"
                        class="group block bg-white hover:bg-slate-50 p-4 rounded-[24px] border border-slate-100 shadow-sm transition-all duration-300 hover:shadow-md hover:scale-[1.01] active:scale-95"
                        in:fly={{ y: 20, duration: 400, delay: i * 50 }}
                    >
                        <div class="flex justify-between items-center mb-3">
                            <div class="flex items-center gap-3">
                                <div
                                    class="w-10 h-10 rounded-2xl flex items-center justify-center transition-colors {expense.transaction_type ===
                                    'income'
                                        ? 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white'
                                        : 'bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white'}"
                                >
                                    {#if expense.transaction_type === "income"}
                                        <Banknote size={20} />
                                    {:else}
                                        <Receipt size={20} />
                                    {/if}
                                </div>
                                <div>
                                    <div
                                        class="font-bold text-slate-900 text-md"
                                    >
                                        {expense.description}
                                    </div>
                                    <div
                                        class="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-0.5"
                                    >
                                        <Calendar size={12} />
                                        {formatDate(expense.paid_at)}
                                    </div>
                                </div>
                            </div>
                            <div class="text-right">
                                <div
                                    class="text-lg font-black font-display tracking-tight {expense.is_reimbursed &&
                                    expense.transaction_type !== 'income'
                                        ? 'text-slate-300 line-through'
                                        : expense.transaction_type === 'income'
                                          ? 'text-emerald-600'
                                          : 'text-slate-900'}"
                                >
                                    {expense.transaction_type === "income"
                                        ? "+"
                                        : ""}{formatCurrency(expense.amount)}
                                </div>
                                {#if expense.transaction_type !== "income"}
                                    <div class="mt-1">
                                        {#if expense.is_reimbursed}
                                            <span
                                                class="text-[9px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                                                ><CheckCircle
                                                    size={10}
                                                    strokeWidth={3}
                                                /> PAID</span
                                            >
                                        {:else}
                                            <span
                                                class="text-[9px] font-black uppercase tracking-widest text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                                                ><XCircle
                                                    size={10}
                                                    strokeWidth={3}
                                                /> PENDING</span
                                            >
                                        {/if}
                                    </div>
                                {/if}
                            </div>
                        </div>

                        <div
                            class="flex justify-between items-center pt-3 border-t border-slate-50"
                        >
                            <div class="flex items-center gap-1.5">
                                <div
                                    class="flex items-center gap-1 bg-slate-50 text-slate-500 px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-100/50"
                                >
                                    <Shapes size={10} />
                                    {expense.projects?.name}
                                </div>
                                {#if expense.category}
                                    <div
                                        class="bg-indigo-50/50 text-indigo-600 px-2 py-1 rounded-lg text-[10px] font-bold border border-indigo-100/30"
                                    >
                                        {expense.category}
                                    </div>
                                {/if}
                                {#if expense.proof_image_url}
                                    <div
                                        class="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors"
                                    >
                                        <FileText size={12} />
                                    </div>
                                {/if}
                            </div>

                            <ChevronRight
                                size={16}
                                class="text-slate-300 group-hover:text-indigo-600 transition-colors group-hover:translate-x-1 duration-300"
                            />
                        </div>
                    </a>
                {/each}
            </div>
        {/if}
    </div>
</div>
