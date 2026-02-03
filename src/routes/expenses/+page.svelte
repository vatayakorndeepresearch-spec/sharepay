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
    } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";

    export let data;
    $: ({ expenses, projects, filters } = data);

    function handleFilterChange(event: Event) {
        const select = event.target as HTMLSelectElement;
        const id = select.id;
        const value = select.value;

        const query = new URLSearchParams($page.url.searchParams);
        query.set(id, value);

        // Reset pagination if needed, but we don't have pagination yet
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

<div class="space-y-4">
    <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold text-gray-800">รายการทั้งหมด</h1>
        <div class="flex gap-2" bind:this={menuRef}>
            <div class="relative">
                <button
                    on:click|stopPropagation={toggleMenu}
                    class="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition shadow-sm text-sm flex items-center gap-2"
                >
                    <CirclePlus size={18} /> เพิ่มรายการ
                </button>

                {#if showAddMenu}
                    <div
                        class="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50 overflow-hidden"
                    >
                        <a
                            href="/expenses/new"
                            class="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition"
                            on:click={() => (showAddMenu = false)}
                        >
                            <div
                                class="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center"
                            >
                                <Plus size={16} />
                            </div>
                            <div>
                                <div class="font-medium">รายการเดียว</div>
                                <div class="text-xs text-gray-500">
                                    จดบันทึกทั่วไป
                                </div>
                            </div>
                        </a>
                        <a
                            href="/expenses/bulk"
                            class="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition border-t border-gray-50"
                            on:click={() => (showAddMenu = false)}
                        >
                            <div
                                class="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center"
                            >
                                <ScanLine size={16} />
                            </div>
                            <div>
                                <div class="font-medium">หลายรายการ</div>
                                <div class="text-xs text-gray-500">
                                    อัพโหลดสลิป
                                </div>
                            </div>
                        </a>
                    </div>
                {/if}
            </div>
        </div>
    </div>

    <!-- Filters -->
    <div
        class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-3"
    >
        <div class="flex items-center gap-2 text-gray-700 font-medium text-sm">
            <Filter size={16} /> ตัวกรอง
        </div>
        <div class="grid grid-cols-3 gap-3">
            <div>
                <label for="type" class="block text-xs text-gray-500 mb-1"
                    >ประเภท</label
                >
                <select
                    id="type"
                    value={filters.type}
                    on:change={handleFilterChange}
                    class="w-full text-sm border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                >
                    <option value="all">ทั้งหมด</option>
                    <option value="income">รายรับ</option>
                    <option value="expense">รายจ่าย</option>
                </select>
            </div>
            <div>
                <label for="project" class="block text-xs text-gray-500 mb-1"
                    >โปรเจค</label
                >
                <select
                    id="project"
                    value={filters.project}
                    on:change={handleFilterChange}
                    class="w-full text-sm border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                >
                    <option value="all">ทั้งหมด</option>
                    {#each projects as project}
                        <option value={project.id}>{project.name}</option>
                    {/each}
                </select>
            </div>
            <div>
                <label for="status" class="block text-xs text-gray-500 mb-1"
                    >สถานะ</label
                >
                <select
                    id="status"
                    value={filters.status}
                    on:change={handleFilterChange}
                    class="w-full text-sm border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                >
                    <option value="all">ทั้งหมด</option>
                    <option value="unpaid">ยังไม่เคลียร์</option>
                    <option value="paid">เคลียร์แล้ว</option>
                </select>
            </div>
        </div>
    </div>

    <!-- List -->
    <div class="bg-white rounded-xl shadow overflow-hidden">
        {#if expenses.length === 0}
            <div class="p-12 text-center">
                <div
                    class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4"
                >
                    <FileText class="text-gray-400" size={32} />
                </div>
                <h3 class="text-lg font-medium text-gray-900 mb-2">
                    ยังไม่มีรายการ
                </h3>
                <p class="text-gray-500 mb-8 max-w-sm mx-auto">
                    เริ่มต้นจดบันทึกรายรับ-รายจ่ายของคุณได้เลย
                    หรือจะอัพโหลดสลิปหลายใบพร้อมกันก็ได้
                </p>
                <div class="flex flex-col sm:flex-row gap-3 justify-center">
                    <a
                        href="/expenses/new"
                        class="inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition shadow-sm"
                    >
                        <Plus size={20} /> เพิ่มรายการใหม่
                    </a>
                    <a
                        href="/expenses/bulk"
                        class="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition"
                    >
                        <ScanLine size={20} /> บันทึกล็อตใหญ่
                    </a>
                </div>
            </div>
        {:else}
            <div class="divide-y divide-gray-100">
                {#each expenses as expense}
                    <a
                        href="/expenses/{expense.id}"
                        class="block p-4 hover:bg-gray-50 transition"
                    >
                        <div class="flex justify-between items-start mb-1">
                            <div>
                                <div class="font-medium text-gray-900">
                                    {expense.description}
                                </div>
                                <div class="text-xs text-gray-500 mt-0.5">
                                    {formatDate(expense.paid_at)}
                                </div>
                            </div>
                            <div class="text-right">
                                <div
                                    class="font-bold {expense.is_reimbursed
                                        ? 'text-gray-400 line-through'
                                        : 'text-indigo-600'}"
                                >
                                    {formatCurrency(expense.amount)}
                                </div>
                            </div>
                        </div>

                        <div class="flex justify-between items-center mt-2">
                            <div class="flex items-center gap-2">
                                <span
                                    class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
                                >
                                    {expense.projects?.name}
                                </span>
                                {#if expense.category}
                                    <span
                                        class="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full"
                                    >
                                        {expense.category}
                                    </span>
                                {/if}
                                {#if expense.proof_image_url}
                                    <FileText size={14} class="text-gray-400" />
                                {/if}
                            </div>

                            <div class="flex items-center gap-1 text-xs">
                                {#if expense.transaction_type !== "income"}
                                    {#if expense.is_reimbursed}
                                        <span
                                            class="text-green-600 flex items-center gap-1"
                                            ><CheckCircle size={12} /> เคลียร์แล้ว</span
                                        >
                                    {:else}
                                        <span
                                            class="text-red-500 flex items-center gap-1"
                                            ><XCircle size={12} /> รอเคลียร์</span
                                        >
                                    {/if}
                                {/if}
                            </div>
                        </div>
                    </a>
                {/each}
            </div>
        {/if}
    </div>
</div>
