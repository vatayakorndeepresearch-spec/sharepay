<script lang="ts">
    import { enhance } from "$app/forms";
    import {
        Loader2,
        ArrowUpRight,
        ArrowDownLeft,
        ArrowLeft,
        Trash2,
    } from "lucide-svelte";

    export let data;
    export let form;

    let loading = false;
    let transactionType = data.expense.transaction_type || "expense";
    let previewUrls: string[] = [];

    function handleFileChange(event: Event) {
        const input = event.target as HTMLInputElement;
        previewUrls = [];

        if (input.files && input.files.length > 0) {
            Array.from(input.files).forEach((file) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (e.target?.result) {
                        previewUrls = [
                            ...previewUrls,
                            e.target.result as string,
                        ];
                    }
                };
                reader.readAsDataURL(file);
            });
        }
    }

    let category = data.expense.category || "Others";
    let description = data.expense.description;

    const expenseCategories = [
        "อาหาร",
        "เดินทาง",
        "ของใช้",
        "ที่พัก",
        "สุขภาพ",
        "บันเทิง",
        "ช้อปปิ้ง",
        "ค่าอินเตอร์เน็ต",
        "ค่าเช่าบ้าน",
        "ค่าชาร์รถ",
        "ค่าน้ำมัน",
        "เงินเดือน",
        "Others",
    ];

    const incomeCategories = [
        "เงินเดือน",
        "โบนัส",
        "ฟรีแลนซ์",
        "การลงทุน",
        "ของขวัญ",
        "เงินคืน",
        "Others",
    ];

    $: availableCategories =
        transactionType === "income" ? incomeCategories : expenseCategories;
</script>

<div class="max-w-lg mx-auto">
    <div class="flex items-center gap-4 mb-6">
        <a
            href="/expenses/{data.expense.id}"
            class="p-2 -ml-2 text-gray-500 hover:text-gray-900 transition rounded-full hover:bg-gray-100"
        >
            <ArrowLeft size={24} />
        </a>
        <h1 class="text-2xl font-bold text-gray-800">แก้ไขรายการ</h1>
    </div>

    {#if form?.error}
        <div class="bg-red-50 text-red-600 p-4 rounded-lg mb-6 text-sm">
            {form.error}
        </div>
    {/if}

    <form
        method="POST"
        action="?/update"
        enctype="multipart/form-data"
        use:enhance={() => {
            loading = true;
            return async ({ update }) => {
                loading = false;
                update();
            };
        }}
        class="space-y-6 bg-white p-6 rounded-xl shadow-sm"
    >
        <!-- Type Toggle -->
        <div class="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
            <label class="cursor-pointer">
                <input
                    type="radio"
                    name="transaction_type"
                    value="income"
                    bind:group={transactionType}
                    class="sr-only"
                />
                <div
                    class="flex items-center justify-center gap-2 py-2 rounded-lg transition-all {transactionType ===
                    'income'
                        ? 'bg-white text-green-600 shadow-sm font-bold'
                        : 'text-gray-500 hover:text-gray-700'}"
                >
                    <ArrowDownLeft size={18} /> รายรับ
                </div>
            </label>
            <label class="cursor-pointer">
                <input
                    type="radio"
                    name="transaction_type"
                    value="expense"
                    bind:group={transactionType}
                    class="sr-only"
                />
                <div
                    class="flex items-center justify-center gap-2 py-2 rounded-lg transition-all {transactionType ===
                    'expense'
                        ? 'bg-white text-red-600 shadow-sm font-bold'
                        : 'text-gray-500 hover:text-gray-700'}"
                >
                    <ArrowUpRight size={18} /> รายจ่าย
                </div>
            </label>
        </div>

        <!-- Project -->
        <div>
            <label
                for="project_id"
                class="block text-sm font-medium text-gray-700 mb-1"
                >โปรเจค</label
            >
            <select
                name="project_id"
                id="project_id"
                required
                class="w-full border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                value={data.expense.project_id}
            >
                {#each data.projects as project}
                    <option value={project.id}>{project.name}</option>
                {/each}
            </select>
        </div>

        <!-- Date -->
        <div>
            <label
                for="paid_at"
                class="block text-sm font-medium text-gray-700 mb-1"
            >
                {transactionType === "expense" ? "วันที่จ่าย" : "วันที่รับเงิน"}
            </label>
            <input
                type="date"
                name="paid_at"
                id="paid_at"
                required
                value={data.expense.paid_at}
                class="w-full border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
            />
        </div>

        <!-- Person -->
        <div>
            <label
                for="paid_by"
                class="block text-sm font-medium text-gray-700 mb-1"
            >
                {transactionType === "expense" ? "ผู้สำรองจ่าย" : "ผู้รับเงิน"}
            </label>
            <select
                name="paid_by"
                id="paid_by"
                required
                class="w-full border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                value={data.expense.paid_by}
            >
                {#each data.profiles as profile}
                    <option value={profile.id}>
                        {profile.display_name}
                    </option>
                {/each}
            </select>
        </div>

        <!-- Amount -->
        <div>
            <label
                for="amount"
                class="block text-sm font-medium text-gray-700 mb-1"
                >จำนวนเงิน (บาท)</label
            >
            <input
                type="number"
                name="amount"
                id="amount"
                required
                min="0"
                step="0.01"
                value={data.expense.amount}
                class="w-full border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="0.00"
            />
        </div>

        <!-- Category -->
        <div>
            <label
                for="category"
                class="block text-sm font-medium text-gray-700 mb-1"
                >หมวดหมู่</label
            >
            <input
                type="text"
                name="category"
                id="category"
                list="categories"
                bind:value={category}
                placeholder="เลือกหรือพิมพ์เอง (เช่น อาหาร, เดินทาง)"
                class="w-full border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
            />
            <datalist id="categories">
                {#each availableCategories as cat}
                    <option value={cat}></option>
                {/each}
            </datalist>
        </div>

        <!-- Description -->
        <div>
            <label
                for="description"
                class="block text-sm font-medium text-gray-700 mb-1"
                >รายละเอียด</label
            >
            <input
                type="text"
                name="description"
                id="description"
                required
                bind:value={description}
                class="w-full border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="ค่าอะไร..."
            />
        </div>

        <!-- Proof Images -->
        <div>
            <label
                for="proof_images"
                class="block text-sm font-medium text-gray-700 mb-1"
                >รูปหลักฐาน (เพิ่มรูปใหม่)</label
            >
            <input
                type="file"
                name="proof_images"
                id="proof_images"
                accept="image/png, image/jpeg"
                multiple
                on:change={handleFileChange}
                class="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
            <p class="mt-1 text-xs text-gray-500">
                PNG, JPG ไม่เกิน 5MB ต่อรูป
            </p>

            <!-- New Previews -->
            {#if previewUrls.length > 0}
                <div class="mt-2 mb-4">
                    <div class="text-xs text-gray-500 mb-1">
                        รูปที่กำลังจะอัพโหลด:
                    </div>
                    <div class="grid grid-cols-3 gap-2">
                        {#each previewUrls as url, i}
                            <div
                                class="relative rounded-lg overflow-hidden border border-gray-200 aspect-square"
                            >
                                <img
                                    src={url}
                                    alt="New Preview {i}"
                                    class="w-full h-full object-cover"
                                />
                            </div>
                        {/each}
                    </div>
                    <button
                        type="button"
                        class="text-xs text-red-500 mt-1 hover:underline"
                        on:click={() => {
                            previewUrls = [];
                            const input = document.getElementById(
                                "proof_images",
                            ) as HTMLInputElement;
                            if (input) input.value = "";
                        }}
                    >
                        ยกเลิกรูปใหม่ทั้งหมด
                    </button>
                </div>
            {/if}

            <!-- Existing Attachments -->
            {#if data.expense.attachments && data.expense.attachments.length > 0}
                <div class="mt-4">
                    <div class="text-xs text-gray-500 mb-2">
                        รูปที่มีอยู่แล้ว:
                    </div>
                    <div class="grid grid-cols-3 gap-2">
                        {#each data.expense.attachments as attachment}
                            <div
                                class="relative group rounded-lg overflow-hidden border border-gray-200 aspect-square"
                            >
                                <img
                                    src={attachment.file_url}
                                    alt="Attachment"
                                    class="w-full h-full object-cover"
                                />
                                <button
                                    type="submit"
                                    formaction="?/deleteAttachment"
                                    name="attachment_id"
                                    value={attachment.id}
                                    class="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 shadow-sm"
                                    title="ลบรูปนี้"
                                    on:click={(e) => {
                                        if (
                                            !confirm("ต้องการลบรูปนี้ใช่ไหม?")
                                        ) {
                                            e.preventDefault();
                                        }
                                    }}
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        {/each}
                    </div>
                </div>
            {:else if data.expense.proof_image_url}
                <!-- Fallback for old data -->
                <div class="mt-4">
                    <div class="text-xs text-gray-500 mb-2">
                        รูปที่มีอยู่แล้ว (เก่า):
                    </div>
                    <div
                        class="relative rounded-lg overflow-hidden border border-gray-200 w-24 h-24"
                    >
                        <img
                            src={data.expense.proof_image_url}
                            alt="Old Proof"
                            class="w-full h-full object-cover"
                        />
                    </div>
                </div>
            {/if}
        </div>

        <!-- Submit -->
        <div class="pt-4 flex gap-3">
            <a
                href="/expenses/{data.expense.id}"
                class="flex-1 py-2.5 text-center border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
                >ยกเลิก</a
            >
            <button
                type="submit"
                disabled={loading}
                class="flex-1 text-white py-2.5 rounded-lg font-bold hover:opacity-90 transition flex justify-center items-center gap-2 disabled:opacity-70 {transactionType ===
                'expense'
                    ? 'bg-red-600'
                    : 'bg-green-600'}"
            >
                {#if loading}
                    <Loader2 class="animate-spin" size={18} /> บันทึก...
                {:else}
                    บันทึกการแก้ไข
                {/if}
            </button>
        </div>
    </form>
</div>
