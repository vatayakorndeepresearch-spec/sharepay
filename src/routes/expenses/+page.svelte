<script lang="ts">
    import { formatCurrency } from "$lib/utils/formatCurrency";
    import { formatDate } from "$lib/utils/formatDate";
    import { FileText, CheckCircle, XCircle, Filter } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";

    export let data;
    $: ({ expenses, projects, filters } = data);

    $: selectedProject = filters?.project || "all";
    $: selectedStatus = filters?.status || "all";

    function applyFilter() {
        const query = new URLSearchParams($page.url.searchParams);
        query.set("project", selectedProject);
        query.set("status", selectedStatus);
        goto(`?${query.toString()}`);
    }
</script>

<div class="space-y-4">
    <div class="flex justify-between items-center">
        <h1 class="text-2xl font-bold text-gray-800">รายการทั้งหมด</h1>
        <a
            href="/expenses/new"
            class="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition shadow-sm text-sm"
        >
            + เพิ่ม
        </a>
    </div>

    <!-- Filters -->
    <div
        class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-3"
    >
        <div class="flex items-center gap-2 text-gray-700 font-medium text-sm">
            <Filter size={16} /> ตัวกรอง
        </div>
        <div class="grid grid-cols-2 gap-3">
            <div>
                <label for="project" class="block text-xs text-gray-500 mb-1"
                    >โปรเจค</label
                >
                <select
                    id="project"
                    bind:value={selectedProject}
                    on:change={applyFilter}
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
                    bind:value={selectedStatus}
                    on:change={applyFilter}
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
            <div class="p-8 text-center text-gray-500">ไม่พบรายการ</div>
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
                            </div>
                        </div>
                    </a>
                {/each}
            </div>
        {/if}
    </div>
</div>
