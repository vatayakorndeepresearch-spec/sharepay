<script lang="ts">
    import { enhance } from "$app/forms";
    import { formatCurrency } from "$lib/utils/formatCurrency";
    import { formatDate } from "$lib/utils/formatDate";
    import {
        ArrowLeft,
        CheckCircle,
        XCircle,
        Calendar,
        User,
        FileText,
        ExternalLink,
        Loader2,
        Pencil,
        Trash2,
    } from "lucide-svelte";

    export let data;
    $: ({ expense, profiles } = data);

    let showReimburseModal = false;
    let loading = false;
    let reimburseProofPreviewUrl: string | null = null;

    function handleReimburseFileChange(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files[0]) {
            const file = input.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                reimburseProofPreviewUrl = e.target?.result as string;
            };
            reader.readAsDataURL(file);
        } else {
            reimburseProofPreviewUrl = null;
        }
    }
</script>

<div class="max-w-lg mx-auto space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
            <a
                href="/expenses"
                class="p-2 -ml-2 text-gray-500 hover:text-gray-900 transition rounded-full hover:bg-gray-100"
            >
                <ArrowLeft size={24} />
            </a>
            <h1 class="text-xl font-bold text-gray-800">รายละเอียด</h1>
        </div>

        <div class="flex gap-2">
            <a
                href="/expenses/{expense.id}/edit"
                class="p-2 text-gray-500 hover:text-indigo-600 transition rounded-full hover:bg-indigo-50"
                title="แก้ไข"
            >
                <Pencil size={20} />
            </a>
            <form
                action="?/delete"
                method="POST"
                use:enhance={({ cancel }) => {
                    if (!confirm("คุณแน่ใจหรือไม่ที่จะลบรายการนี้?")) {
                        cancel();
                    }
                }}
            >
                <button
                    type="submit"
                    class="p-2 text-gray-500 hover:text-red-600 transition rounded-full hover:bg-red-50"
                    title="ลบ"
                >
                    <Trash2 size={20} />
                </button>
            </form>
        </div>
    </div>

    <!-- Status Card -->
    <div
        class="bg-white rounded-xl shadow-sm p-6 border-l-4 {expense.is_reimbursed
            ? 'border-green-500'
            : 'border-red-500'}"
    >
        <div class="flex justify-between items-start">
            <div>
                <div class="text-sm text-gray-500 mb-1">สถานะ</div>
                <div
                    class="font-bold text-lg flex items-center gap-2 {expense.is_reimbursed
                        ? 'text-green-600'
                        : 'text-red-600'}"
                >
                    {#if expense.is_reimbursed}
                        <CheckCircle size={20} /> เคลียร์แล้ว
                    {:else}
                        <XCircle size={20} /> ยังไม่เคลียร์
                    {/if}
                </div>
                {#if expense.is_reimbursed && expense.reimbursed_at}
                    <div class="text-xs text-gray-400 mt-1">
                        เมื่อ {formatDate(expense.reimbursed_at)}
                        {#if expense.reimburser}
                            โดย {expense.reimburser.display_name}
                        {/if}
                    </div>
                {/if}
            </div>
            <div class="text-right">
                <div class="text-sm text-gray-500 mb-1">ยอดเงิน</div>
                <div class="text-2xl font-bold text-gray-900">
                    {formatCurrency(expense.amount)}
                </div>
            </div>
        </div>
    </div>

    <!-- Details -->
    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
        <div class="p-6 space-y-4">
            <div>
                <h3 class="text-sm font-medium text-gray-500 mb-1">รายการ</h3>
                <p class="text-lg font-medium text-gray-900">
                    {expense.description}
                </p>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div>
                    <h3
                        class="text-sm font-medium text-gray-500 mb-1 flex items-center gap-1"
                    >
                        <Calendar size={14} /> วันที่จ่าย
                    </h3>
                    <p class="text-gray-900">{formatDate(expense.paid_at)}</p>
                </div>
                <div>
                    <h3
                        class="text-sm font-medium text-gray-500 mb-1 flex items-center gap-1"
                    >
                        <User size={14} /> ผู้สำรองจ่าย
                    </h3>
                    <p class="text-gray-900">
                        {expense.profiles?.display_name || "ไม่ระบุ"}
                    </p>
                </div>
            </div>

            <div>
                <h3 class="text-sm font-medium text-gray-500 mb-1">โปรเจค</h3>
                <span
                    class="inline-block bg-gray-100 px-3 py-1 rounded-full text-sm text-gray-700 font-medium"
                >
                    {expense.projects?.name}
                </span>
            </div>

            {#if expense.category}
                <div>
                    <h3 class="text-sm font-medium text-gray-500 mb-1">
                        หมวดหมู่
                    </h3>
                    <span
                        class="inline-block bg-indigo-50 px-3 py-1 rounded-full text-sm text-indigo-700 font-medium"
                    >
                        {expense.category}
                    </span>
                </div>
            {/if}

            {#if expense.notes}
                <div>
                    <h3 class="text-sm font-medium text-gray-500 mb-1">
                        หมายเหตุ
                    </h3>
                    <p class="text-gray-700 bg-gray-50 p-3 rounded-lg text-sm">
                        {expense.notes}
                    </p>
                </div>
            {/if}
        </div>

        <!-- Expense Proof Images (Gallery) -->
        {#if expense.attachments && expense.attachments.length > 0}
            <div class="border-t border-gray-100 p-6">
                <h3
                    class="text-sm font-medium text-gray-500 mb-3 flex items-center gap-1"
                >
                    <FileText size={14} /> หลักฐานการจ่าย ({expense.attachments
                        .length} รูป)
                </h3>
                <div class="grid grid-cols-2 gap-2">
                    {#each expense.attachments as attachment}
                        <div
                            class="relative group rounded-lg overflow-hidden border border-gray-200 aspect-square"
                        >
                            <img
                                src={attachment.file_url}
                                alt="Proof"
                                class="w-full h-full object-cover"
                            />
                            <a
                                href={attachment.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition opacity-0 group-hover:opacity-100"
                            >
                                <ExternalLink size={16} />
                            </a>
                        </div>
                    {/each}
                </div>
            </div>
        {:else if expense.proof_image_url}
            <!-- Fallback for old data -->
            <div class="border-t border-gray-100 p-6">
                <h3
                    class="text-sm font-medium text-gray-500 mb-3 flex items-center gap-1"
                >
                    <FileText size={14} /> หลักฐานการจ่าย
                </h3>
                <div
                    class="relative group rounded-lg overflow-hidden border border-gray-200"
                >
                    <img
                        src={expense.proof_image_url}
                        alt="Proof"
                        class="w-full h-auto object-cover max-h-96"
                    />
                    <a
                        href={expense.proof_image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition opacity-0 group-hover:opacity-100"
                    >
                        <ExternalLink size={16} />
                    </a>
                </div>
            </div>
        {/if}

        <!-- Reimbursement Proof Image -->
        {#if expense.reimbursement_proof_url}
            <div class="border-t border-gray-100 p-6 bg-green-50">
                <h3
                    class="text-sm font-medium text-green-700 mb-3 flex items-center gap-1"
                >
                    <CheckCircle size={14} /> หลักฐานการโอนคืน
                </h3>
                <div
                    class="relative group rounded-lg overflow-hidden border border-green-200"
                >
                    <img
                        src={expense.reimbursement_proof_url}
                        alt="Reimbursement Proof"
                        class="w-full h-auto object-cover max-h-96"
                    />
                    <a
                        href={expense.reimbursement_proof_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition opacity-0 group-hover:opacity-100"
                    >
                        <ExternalLink size={16} />
                    </a>
                </div>
            </div>
        {/if}
    </div>

    <!-- Actions -->
    <div class="pb-8">
        {#if !expense.is_reimbursed}
            <button
                on:click={() => (showReimburseModal = true)}
                class="w-full bg-green-600 text-white py-3 rounded-xl font-bold text-lg shadow-lg hover:bg-green-700 transition flex justify-center items-center gap-2"
            >
                <CheckCircle /> ทำเครื่องหมายว่าเคลียร์แล้ว
            </button>
        {:else}
            <form
                action="/expenses/{expense.id}?/unreimburse"
                method="POST"
                use:enhance
            >
                <button
                    class="w-full bg-gray-100 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-200 transition text-sm"
                >
                    ยกเลิกสถานะเคลียร์แล้ว (กลับไปเป็นหนี้)
                </button>
            </form>
        {/if}
    </div>
</div>

<!-- Reimburse Modal -->
{#if showReimburseModal}
    <div
        class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
    >
        <div class="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 class="text-lg font-bold mb-4">ยืนยันการเคลียร์ยอด</h3>
            <form
                action="/expenses/{expense.id}?/reimburse"
                method="POST"
                enctype="multipart/form-data"
                use:enhance={() => {
                    loading = true;
                    return async ({ update }) => {
                        loading = false;
                        showReimburseModal = false;
                        update();
                    };
                }}
            >
                <div class="mb-4">
                    <label
                        for="reimbursed_by"
                        class="block text-sm font-medium text-gray-700 mb-1"
                        >ใครเป็นคนคืนเงิน?</label
                    >
                    <select
                        name="reimbursed_by"
                        id="reimbursed_by"
                        class="w-full border-gray-300 rounded-lg"
                    >
                        <option value="">ไม่ระบุ</option>
                        {#each profiles as profile}
                            {#if profile.id !== expense.paid_by}
                                <option value={profile.id}
                                    >{profile.display_name}</option
                                >
                            {/if}
                        {/each}
                    </select>
                </div>

                <div class="mb-6">
                    <label
                        for="proof_image"
                        class="block text-sm font-medium text-gray-700 mb-1"
                        >สลิปโอนเงิน (ถ้ามี)</label
                    >
                    <input
                        type="file"
                        name="proof_image"
                        id="proof_image"
                        accept="image/png, image/jpeg"
                        class="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                        on:change={handleReimburseFileChange}
                    />
                    {#if reimburseProofPreviewUrl}
                        <div
                            class="mt-2 relative rounded-lg overflow-hidden border border-gray-200 w-full max-w-xs"
                        >
                            <img
                                src={reimburseProofPreviewUrl}
                                alt="Preview"
                                class="w-full h-auto object-cover"
                            />
                            <button
                                type="button"
                                class="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
                                on:click={() => {
                                    reimburseProofPreviewUrl = null;
                                    const input = document.getElementById(
                                        "proof_image",
                                    ) as HTMLInputElement;
                                    if (input) input.value = "";
                                }}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    ><line x1="18" y1="6" x2="6" y2="18"
                                    ></line><line x1="6" y1="6" x2="18" y2="18"
                                    ></line></svg
                                >
                            </button>
                        </div>
                    {/if}
                </div>

                <div class="flex gap-3">
                    <button
                        type="button"
                        on:click={() => {
                            showReimburseModal = false;
                            reimburseProofPreviewUrl = null;
                        }}
                        class="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                        >ยกเลิก</button
                    >
                    <button
                        type="submit"
                        disabled={loading}
                        class="flex-1 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-70 flex justify-center items-center gap-2"
                    >
                        {#if loading}
                            <Loader2 class="animate-spin" size={16} /> กำลังบันทึก...
                        {:else}
                            ยืนยัน
                        {/if}
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}
