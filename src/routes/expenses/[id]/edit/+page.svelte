<script lang="ts">
    import { enhance } from "$app/forms";
    import {
        Loader2,
        ArrowUpRight,
        ArrowDownLeft,
        ArrowLeft,
        Trash2,
        ScanLine,
    } from "lucide-svelte";
    import { createWorker } from "tesseract.js";

    export let data;
    export let form;

    let loading = false;
    let scanning = false;
    let transactionType = data.expense.transaction_type || "expense";
    let previewUrls: string[] = [];

    // Local bindings for form fields to allow programmatic updates
    let amount = data.expense.amount;
    let notes = data.expense.notes || "";
    let paidAt = data.expense.paid_at;

    async function processOCR(file: File) {
        scanning = true;
        try {
            const worker = await createWorker("tha+eng");
            const {
                data: { text },
            } = await worker.recognize(file);
            console.log("OCR Raw Text:", text);

            const lines = text.split("\n");

            // --- 1. Extract Amount ---
            let extractedAmount = null;
            const amountLineRegex =
                /(?:จำนวน|amount)\s*[:.]?\s*([\d,]+\.\d{2})/i;

            for (let line of lines) {
                const match = line.match(amountLineRegex);
                if (match) {
                    extractedAmount = parseFloat(match[1].replace(/,/g, ""));
                    break;
                }
            }

            if (!extractedAmount) {
                const strictCurrency = text.match(
                    /([\d,]+\.\d{2})\s*(?:THB|บาท)/i,
                );
                if (strictCurrency) {
                    extractedAmount = parseFloat(
                        strictCurrency[1].replace(/,/g, ""),
                    );
                }
            }

            if (extractedAmount && !isNaN(extractedAmount)) {
                amount = extractedAmount;
            }

            // --- 2. Extract Date/Time (Priority: Thai/K-Plus format) ---
            // Pattern: 31 ธ.ค. 68 or 31ธ.ค.68 or 31 Dec 2025
            const thaiDateRegex =
                /(\d{1,2})\s*([ก-๙\.\s]{2,}|[a-zA-Z]{3,}\.?)\s*(\d{2,4})/;

            let foundDate = false;
            for (let line of lines) {
                const match = line.match(thaiDateRegex);
                if (match) {
                    const d = parseInt(match[1]); // Day
                    const mStr = match[2].toLowerCase(); // Month part
                    const y = parseInt(match[3]); // Year

                    // Normalize month string (remove dots, trim, spaces)
                    const normalizedMonth = mStr.replace(/[\.\s]/g, "");

                    const monthMap: Record<string, number> = {
                        มค: 0,
                        กพ: 1,
                        มีค: 2,
                        เมย: 3,
                        พค: 4,
                        มิย: 5,
                        กค: 6,
                        สค: 7,
                        กย: 8,
                        ตค: 9,
                        พย: 10,
                        ธค: 11,
                        มกราคม: 0,
                        กุมภาพันธ์: 1,
                        มีนาคม: 2,
                        เมษายน: 3,
                        พฤษภาคม: 4,
                        มิถุนายน: 5,
                        กรกฎาคม: 6,
                        สิงหาคม: 7,
                        กันยายน: 8,
                        ตุลาคม: 9,
                        พฤศจิกายน: 10,
                        ธันวาคม: 11,
                        jan: 0,
                        feb: 1,
                        mar: 2,
                        apr: 3,
                        may: 4,
                        jun: 5,
                        jul: 6,
                        aug: 7,
                        sep: 8,
                        oct: 9,
                        nov: 10,
                        dec: 11,
                        january: 0,
                        february: 1,
                        march: 2,
                        april: 3,
                        june: 5,
                        july: 6,
                        august: 7,
                        september: 8,
                        october: 9,
                        november: 10,
                        december: 11,
                    };

                    // Try direct match or partial match
                    let monthIndex = monthMap[normalizedMonth];

                    // If not found, try to find if any key is contained in normalizedMonth
                    if (monthIndex === undefined) {
                        for (const key in monthMap) {
                            if (normalizedMonth.includes(key)) {
                                monthIndex = monthMap[key];
                                break;
                            }
                        }
                    }

                    if (monthIndex !== undefined) {
                        let fullYear = 2000;
                        if (y > 2500) {
                            // BE Full
                            fullYear = y - 543;
                        } else if (y >= 2000) {
                            // AD Full
                            fullYear = y;
                        } else {
                            // Short Year
                            // If > 50, likely BE short (68 -> 2568 -> 2025)
                            // If < 50, likely AD short (25 -> 2025)
                            if (y > 50) {
                                fullYear = 2500 + y - 543;
                            } else {
                                fullYear = 2000 + y;
                            }
                        }

                        // Validate date components
                        if (
                            d >= 1 &&
                            d <= 31 &&
                            monthIndex >= 0 &&
                            monthIndex <= 11
                        ) {
                            const pad = (n: number) =>
                                String(n).padStart(2, "0");
                            const newDate = `${fullYear}-${pad(monthIndex + 1)}-${pad(d)}`;
                            console.log(
                                "OCR Extracted Date:",
                                newDate,
                                "from line:",
                                line,
                            );
                            paidAt = newDate;
                            foundDate = true;
                        }
                    }
                    if (foundDate) break;
                }
            }

            // --- 3. Extract Note/Memo ---
            let extractedNote = "";
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.match(/(?:บันทึกช่วยจำ|บันทึกช่วยจํา|Note|Memo)/i)) {
                    let content = line
                        .replace(
                            /.*(?:บันทึกช่วยจำ|บันทึกช่วยจํา|Note|Memo)\s*[:.]?\s*/i,
                            "",
                        )
                        .trim();

                    if (!content && i + 1 < lines.length) {
                        content = lines[i + 1].trim();
                    }

                    if (content) {
                        extractedNote = content;
                    }
                    break;
                }
            }

            if (extractedNote) {
                notes = extractedNote;
                description = extractedNote; // Map Memo to Description
            }

            await worker.terminate();
        } catch (err) {
            console.error("OCR Error:", err);
        } finally {
            scanning = false;
        }
    }

    function handleFileChange(event: Event) {
        const input = event.target as HTMLInputElement;
        previewUrls = [];

        if (input.files && input.files.length > 0) {
            const files = Array.from(input.files);

            // Run OCR on the first file if it exists
            if (files[0]) {
                processOCR(files[0]);
            }

            files.forEach((file) => {
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
    ];

    const incomeCategories = [
        "เงินเดือน",
        "โบนัส",
        "ฟรีแลนซ์",
        "การลงทุน",
        "ของขวัญ",
        "เงินคืน",
    ];

    let category = data.expense.category || "Others";
    let customCategory = "";
    let isCustomCategory = false;
    let description = data.expense.description;

    // Check if existing category is not in the predefined list
    $: {
        const currentCategories =
            transactionType === "income" ? incomeCategories : expenseCategories;
        if (
            category &&
            !currentCategories.includes(category) &&
            category !== "custom"
        ) {
            isCustomCategory = true;
            customCategory = category;
            category = "custom";
        }
    }

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
                bind:value={paidAt}
                class="w-full border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition-colors {scanning
                    ? 'bg-indigo-50 animate-pulse'
                    : ''}"
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
                bind:value={amount}
                class="w-full border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition-colors {scanning
                    ? 'bg-indigo-50 animate-pulse'
                    : ''}"
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
            <select
                id="category-select"
                bind:value={category}
                on:change={(e) => {
                    if (e.currentTarget.value === "custom") {
                        isCustomCategory = true;
                    } else {
                        isCustomCategory = false;
                        customCategory = "";
                    }
                }}
                class="w-full border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
            >
                <option value="">-- เลือกหมวดหมู่ --</option>
                {#each availableCategories as cat}
                    <option value={cat}>{cat}</option>
                {/each}
                <option value="custom">➕ อื่นๆ (พิมพ์เอง)</option>
            </select>

            {#if isCustomCategory}
                <input
                    type="text"
                    bind:value={customCategory}
                    placeholder="พิมพ์หมวดหมู่ใหม่..."
                    class="w-full mt-2 border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                />
            {/if}

            <!-- Hidden input to submit actual category value -->
            <input
                type="hidden"
                name="category"
                value={isCustomCategory ? customCategory : category}
            />
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
                bind:value={notes}
                class="w-full border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition-colors {scanning
                    ? 'bg-indigo-50 animate-pulse'
                    : ''}"
                placeholder="รายละเอียดเพิ่มเติม..."
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
            {#if scanning}
                <div
                    class="mt-2 text-indigo-600 flex items-center gap-2 text-sm"
                >
                    <ScanLine class="animate-spin" size={16} /> กำลังอ่านข้อมูลจากสลิป...
                </div>
            {/if}

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
