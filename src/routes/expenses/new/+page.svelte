<script lang="ts">
    import { enhance } from "$app/forms";
    import { Loader2, ArrowUpRight, ArrowDownLeft } from "lucide-svelte";

    export let data;
    export let form;

    let loading = false;
    let transactionType = "expense"; // 'expense' | 'income'

    // Default to today (Local Time)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const today = `${year}-${month}-${day}`;

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

    let category = "";
    let description = "";

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
    <h1 class="text-2xl font-bold text-gray-800 mb-6">เพิ่มรายการใหม่</h1>

    {#if form?.error}
        <div class="bg-red-50 text-red-600 p-4 rounded-lg mb-6 text-sm">
            {form.error}
        </div>
    {/if}

    <form
        method="POST"
        action="/expenses/new?/save"
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
                value={today}
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

        <!-- Note -->
        <div>
            <label
                for="notes"
                class="block text-sm font-medium text-gray-700 mb-1"
                >หมายเหตุ (ไม่บังคับ)</label
            >
            <input
                type="text"
                name="notes"
                id="notes"
                class="w-full border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="รายละเอียดเพิ่มเติม..."
            />
        </div>

        <!-- Proof Images -->
        <div>
            <label
                for="proof_images"
                class="block text-sm font-medium text-gray-700 mb-1"
                >รูปหลักฐาน (เลือกได้หลายรูป)</label
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

            {#if previewUrls.length > 0}
                <div class="mt-2 grid grid-cols-3 gap-2">
                    {#each previewUrls as url, i}
                        <div
                            class="relative rounded-lg overflow-hidden border border-gray-200 aspect-square"
                        >
                            <img
                                src={url}
                                alt="Preview {i}"
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
                    ล้างรูปทั้งหมด
                </button>
            {/if}
        </div>

        <!-- Is Reimbursed (Only for Expense) -->
        {#if transactionType === "expense"}
            <div class="flex items-center gap-2 pt-2">
                <input
                    type="checkbox"
                    name="is_reimbursed"
                    id="is_reimbursed"
                    class="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label for="is_reimbursed" class="text-sm text-gray-700"
                    >เคลียร์เงินแล้ว</label
                >
            </div>
        {/if}

        <!-- Submit -->
        <div class="pt-4 flex gap-3">
            <a
                href="/expenses"
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
                    บันทึก{transactionType === "expense" ? "รายจ่าย" : "รายรับ"}
                {/if}
            </button>
        </div>
    </form>
</div>
