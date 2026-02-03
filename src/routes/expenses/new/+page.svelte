<script lang="ts">
    import { enhance } from "$app/forms";
    import {
        Loader2,
        ArrowUpRight,
        ArrowDownLeft,
        ScanLine,
    } from "lucide-svelte";
    import { createWorker } from "tesseract.js";
    import { preprocessImage } from "$lib/utils/imageProcessor";

    export let data;
    export let form;

    let loading = false;
    let scanning = false;
    let transactionType = "expense"; // 'expense' | 'income'

    // Default to today (Local Time)
    // Default to today (Local Time)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    // Bindable date variable
    let paidAt = `${year}-${month}-${day}`;

    let previewUrls: string[] = [];

    // Local bindings
    let amount: number | null = null;
    let notes = "";
    let description = "";

    async function processOCR(file: File) {
        scanning = true;
        try {
            const worker = await createWorker("tha+eng");

            // Preprocess for OCR
            const processedImageUrl = await preprocessImage(file);
            console.log("Processed Image URL:", processedImageUrl);

            const {
                data: { text },
            } = await worker.recognize(processedImageUrl);
            console.log("OCR Raw Text:", text);

            const lines = text
                .split("\n")
                .map((l) => l.trim())
                .filter((l) => l.length > 0);
            console.log("OCR Lines:", lines);

            // --- 1. Extract Amount ---
            // Handle both same-line and next-line patterns
            let extractedAmount: number | null = null;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();

                // Pattern 1: "จำนวน: 88.00" on same line
                const sameLineMatch = line.match(
                    /(?:จำนวน|จํานวน)\s*[:.]?\s*([\d,]+\.?\d*)/i,
                );
                if (sameLineMatch && sameLineMatch[1]) {
                    const val = parseFloat(sameLineMatch[1].replace(/,/g, ""));
                    if (!isNaN(val) && val > 0) {
                        extractedAmount = val;
                        break;
                    }
                }

                // Pattern 2: "จำนวน:" label only, amount on next line
                if (
                    line.match(/(?:จำนวน|จํานวน)\s*[:.]?\s*$/i) &&
                    i + 1 < lines.length
                ) {
                    const nextLine = lines[i + 1].trim();
                    const nextMatch = nextLine.match(
                        /([\d,]+\.?\d*)\s*(?:บาท|THB)?/i,
                    );
                    if (nextMatch && nextMatch[1]) {
                        const val = parseFloat(nextMatch[1].replace(/,/g, ""));
                        if (!isNaN(val) && val > 0) {
                            extractedAmount = val;
                            break;
                        }
                    }
                }
            }

            // Fallback: Find "XX.XX บาท" but skip fee lines
            if (!extractedAmount) {
                for (let line of lines) {
                    if (line.match(/ค่าธรรมเนียม|fee/i)) continue;
                    const match = line.match(/([\d,]+\.\d{2})\s*(?:บาท|THB)/i);
                    if (match) {
                        const val = parseFloat(match[1].replace(/,/g, ""));
                        if (!isNaN(val) && val > 0) {
                            extractedAmount = val;
                            break;
                        }
                    }
                }
            }

            if (extractedAmount && !isNaN(extractedAmount)) {
                amount = extractedAmount;
            }

            // --- 2. Extract Date ---
            // KBank format: "6 ม.ค. 69" or "31 ธ.ค. 68"
            // Common OCR misreads:
            // ธ.ค. -> 5.m., s.m., 8.m., s.m, 5.H., sn., sk., sK., ธค
            // ม.ค. -> 1.ค., w.ค., 2.m., wk., mk.
            const thaiMonthMap: Record<string, number> = {
                // Short forms (1-indexed)
                มค: 1,
                กพ: 2,
                มีค: 3,
                เมย: 4,
                พค: 5,
                มิย: 6,
                กค: 7,
                สค: 8,
                กย: 9,
                ตค: 10,
                พย: 11,
                ธค: 12,
                // Full forms
                มกราคม: 1,
                กุมภาพันธ์: 2,
                มีนาคม: 3,
                เมษายน: 4,
                พฤษภาคม: 5,
                มิถุนายน: 6,
                กรกฎาคม: 7,
                สิงหาคม: 8,
                กันยายน: 9,
                ตุลาคม: 10,
                พฤศจิกายน: 11,
                ธันวาคม: 12,
                // English
                jan: 1,
                feb: 2,
                mar: 3,
                apr: 4,
                may: 5,
                jun: 6,
                jul: 7,
                aug: 8,
                sep: 9,
                oct: 10,
                nov: 11,
                dec: 12,
                // Common OCR Misreads (KBank specific)
                "5m": 12,
                sm: 12,
                "8m": 12,
                "s.m": 12,
                "5.m": 12,
                sh: 12,
                "5h": 12,
                sk: 12,
                sn: 12,
                "5n": 12,
                "5k": 12,
                "1m": 1,
                nm: 1,
                wk: 1,
                mk: 1,
                // KKP Better OCR Misreads
                nw: 2, // ก.พ. (February)
                "n.w": 2,
                aw: 2,
                "a.w": 2,
            };

            console.log("[OCR] Starting date extraction from lines:", lines);

            // Strategy: Find the date line
            // - KBank: "DD Month YY HH:MM น."
            // - KKP Better: "วันที่ 3 ก.พ. 2569 10:57"
            let dateLine: string | null = null;

            for (const line of lines) {
                // KKP Better format: Line contains "วันที่"
                if (
                    line.includes("วันที่") ||
                    line.includes("วนท") ||
                    line.includes("วันท")
                ) {
                    dateLine = line;
                    console.log(
                        `[OCR] Found date line (KKP Better): "${dateLine}"`,
                    );
                    break;
                }

                // KBank format: Line with time pattern and starts with day number
                if (
                    line.match(/\d{1,2}:\d{2}/) ||
                    line.includes("น.") ||
                    line.includes("น,")
                ) {
                    if (line.match(/^\d{1,2}\s/)) {
                        dateLine = line;
                        console.log(
                            `[OCR] Found date line (KBank): "${dateLine}"`,
                        );
                        break;
                    }
                }
            }

            // Fallback: Find line starting with DD Month pattern
            if (!dateLine) {
                for (const line of lines) {
                    if (
                        line.match(/^\d{1,2}\s+[ก-๙a-zA-Z0-9\.\-]+\s+\d{2,4}/)
                    ) {
                        dateLine = line;
                        console.log(
                            `[OCR] Found date line (fallback): "${dateLine}"`,
                        );
                        break;
                    }
                }
            }

            if (dateLine) {
                // Extract date from the identified date line
                // Pattern 1: Starts with day number (KBank: "27 ธ.ค. 68")
                // Pattern 2: Has วันที่ label (KKP Better: "วันที่ 3 ก.พ. 2569")
                let fullMatch = dateLine.match(
                    /^(\d{1,2})[\s\.\/-]+([ก-๙a-zA-Z0-9\.\-]+)[\s\.\/-]+(\d{2,4})/,
                );

                // If no match at start, try matching after วันที่ label
                if (!fullMatch) {
                    fullMatch = dateLine.match(
                        /(?:วันที่|วนท|วันท)[\s:]*(\d{1,2})[\s\.\/-]+([ก-๙a-zA-Z0-9\.\-]+)[\s\.\/-]+(\d{2,4})/,
                    );
                }

                console.log(`[OCR] DateLine Match:`, fullMatch);

                if (fullMatch) {
                    const d = parseInt(fullMatch[1]);
                    const mStrRaw = fullMatch[2].toLowerCase();
                    const mStr = mStrRaw.replace(/[\.\s\-]/g, "");
                    const yRaw = parseInt(fullMatch[3]);

                    console.log(
                        `[OCR] Parsed: day=${d}, mStr="${mStr}", year=${yRaw}`,
                    );

                    // Try map
                    let m = thaiMonthMap[mStr];

                    if (!m) {
                        // Fuzzy search map
                        for (const [key, val] of Object.entries(thaiMonthMap)) {
                            if (
                                mStr.length >= 2 &&
                                (mStr.startsWith(key) ||
                                    key.startsWith(mStr) ||
                                    mStr.includes(key))
                            ) {
                                m = val;
                                console.log(
                                    `[OCR] Fuzzy match: "${mStr}" -> key "${key}" -> month ${m}`,
                                );
                                break;
                            }
                        }
                    }

                    // Desperate fuzzy check for common OCR errors
                    if (!m) {
                        // December patterns: 5m, sm, 8m, sk, sn, etc.
                        if (
                            (mStr.includes("m") ||
                                mStr.includes("n") ||
                                mStr.includes("k") ||
                                mStr.includes("h")) &&
                            (mStr.includes("5") ||
                                mStr.includes("s") ||
                                mStr.includes("8"))
                        ) {
                            m = 12;
                            console.log(
                                `[OCR] Desperate match: "${mStr}" -> December (12)`,
                            );
                        }
                        // Thai ธ.ค. patterns
                        if (mStr.includes("ค") || mStr.includes("ธ")) {
                            m = 12;
                            console.log(
                                `[OCR] Thai char match: "${mStr}" -> December (12)`,
                            );
                        }
                        // Thai ม.ค. patterns
                        if (
                            mStr.includes("ม") &&
                            (mStr.includes("ค") || mStr.length <= 3)
                        ) {
                            m = 1;
                            console.log(
                                `[OCR] Thai char match: "${mStr}" -> January (1)`,
                            );
                        }
                    }

                    if (m && d >= 1 && d <= 31) {
                        let finalYear = yRaw;

                        // Normalize year
                        if (finalYear > 2500) {
                            finalYear = finalYear - 543;
                        } else if (finalYear < 100) {
                            if (finalYear > 40)
                                finalYear = 2500 + finalYear - 543;
                            else finalYear = 2000 + finalYear;
                        }

                        if (finalYear >= 2000 && finalYear <= 2100) {
                            const pad = (n: number) =>
                                String(n).padStart(2, "0");
                            paidAt = `${finalYear}-${pad(m)}-${pad(d)}`;
                            console.log(`[OCR] Date SUCCESS: ${paidAt}`);
                        }
                    }
                }
            }

            // Fallback: Search all lines for numeric date
            if (paidAt === `${year}-${month}-${day}`) {
                for (const line of lines) {
                    const numericMatch = line.match(
                        /(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{2,4})/,
                    );
                    if (numericMatch) {
                        const dd = parseInt(numericMatch[1]);
                        const mm = parseInt(numericMatch[2]);
                        const yy = parseInt(numericMatch[3]);
                        if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12) {
                            let finalYear = yy;
                            if (finalYear > 2500) finalYear -= 543;
                            else if (finalYear < 100) {
                                if (finalYear > 40)
                                    finalYear = 2500 + finalYear - 543;
                                else finalYear = 2000 + finalYear;
                            }
                            const pad = (n: number) =>
                                String(n).padStart(2, "0");
                            paidAt = `${finalYear}-${pad(mm)}-${pad(dd)}`;
                            console.log(
                                `[OCR] Date SUCCESS (Numeric): ${paidAt}`,
                            );
                            break;
                        }
                    }
                }
            }

            // --- 3. Extract Note/Memo ---
            // KBank: "บันทึกช่วยจำ: xxx"
            // KKP Better: Just "ค่าข้าว" at the bottom
            let extractedNote = "";

            // First try: Look for labeled notes (KBank style)
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const noteLabelMatch = line.match(
                    /(?:บันทึกช่วยจำ|บันทึกช่วยจํา|Note|Memo)/i,
                );
                if (noteLabelMatch) {
                    let content = line
                        .substring(
                            noteLabelMatch.index! + noteLabelMatch[0].length,
                        )
                        .replace(/^[:.\s]+/, "")
                        .trim();
                    if (!content && i + 1 < lines.length)
                        content = lines[i + 1].trim();
                    if (content) {
                        extractedNote = content;
                        break;
                    }
                }
            }

            // Fallback: KKP Better - Look for lines containing "ค่า" (expense descriptions)
            // OCR may add prefixes like "BE" before the actual note
            if (!extractedNote) {
                for (let i = lines.length - 1; i >= 0; i--) {
                    const line = lines[i].trim();
                    // Look for "ค่า" anywhere in line (e.g., "BE ค่าข้าว")
                    const noteMatch = line.match(/ค่า[ก-๙a-zA-Z]+/);
                    if (noteMatch) {
                        extractedNote = noteMatch[0];
                        console.log(
                            `[OCR] Found note (KKP Better): "${extractedNote}" from line: "${line}"`,
                        );
                        break;
                    }
                }
            }

            if (extractedNote) {
                notes = extractedNote;
                description = extractedNote;
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

    let category = "";
    let customCategory = "";
    let isCustomCategory = false;

    const expenseCategories = [
        "อาหาร",
        "เดินทาง",
        "ของใช้",
        "ที่พัก",
        "สุขภาพ",
        "บันเทิง",
        "ช้อปปิ้ง",
        "ค่าน้ำ",
        "ค่าไฟ",
        "ค่าโทรศัพท์",
        "ค่าอินเตอร์เน็ต",
        "ค่าสมาชิก/Sub",
        "ค่าเช่าบ้าน",
        "ค่าชาร์จรถ",
        "ค่าน้ำมัน",
        "ประกัน",
        "การศึกษา",
        "สัตว์เลี้ยง",
        "บริจาค/ทำบุญ",
    ];

    const incomeCategories = [
        "เงินเดือน",
        "โบนัส",
        "ฟรีแลนซ์",
        "การลงทุน",
        "ของขวัญ",
        "เงินคืน",
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
                value={data.projects.find((p) => p.name === "กองกลาง")?.id ||
                    data.projects[0]?.id}
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
            {#if scanning}
                <div
                    class="mt-2 text-indigo-600 flex items-center gap-2 text-sm"
                >
                    <ScanLine class="animate-spin" size={16} /> กำลังอ่านข้อมูลจากสลิป...
                </div>
            {/if}

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
