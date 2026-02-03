<script lang="ts">
    import { enhance } from "$app/forms";
    import {
        Loader2,
        ArrowUpRight,
        ArrowDownLeft,
        ScanLine,
        ChevronLeft,
        Image as ImageIcon,
        Sparkles,
    } from "lucide-svelte";
    import { getOCRWorker } from "$lib/stores/ocrStore";
    import { preprocessImage } from "$lib/utils/imageProcessor";
    import { fade, slide, scale } from "svelte/transition";

    export let data;
    export let form;

    let loading = false;
    let scanning = false;
    let transactionType = "expense"; // 'expense' | 'income'

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
            const worker = await getOCRWorker();

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

            // --- 1. Extract Amount ---
            let extractedAmount: number | null = null;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
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
            if (extractedAmount && !isNaN(extractedAmount))
                amount = extractedAmount;

            // --- 2. Extract Date ---
            const thaiMonthMap: Record<string, number> = {
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
                nw: 2,
                "n.w": 2,
                aw: 2,
                "a.w": 2,
            };

            let dateLine: string | null = null;
            for (const line of lines) {
                if (
                    line.includes("วันที่") ||
                    line.includes("วนท") ||
                    line.includes("วันท")
                ) {
                    dateLine = line;
                    break;
                }
                if (
                    line.match(/\d{1,2}:\d{2}/) ||
                    line.includes("น.") ||
                    line.includes("น,")
                ) {
                    if (line.match(/^\d{1,2}\s/)) {
                        dateLine = line;
                        break;
                    }
                }
            }
            if (!dateLine) {
                for (const line of lines) {
                    if (
                        line.match(/^\d{1,2}\s+[ก-๙a-zA-Z0-9\.\-]+\s+\d{2,4}/)
                    ) {
                        dateLine = line;
                        break;
                    }
                }
            }
            if (dateLine) {
                let fullMatch =
                    dateLine.match(
                        /^(\d{1,2})[\s\.\/-]+([ก-๙a-zA-Z0-9\.\-]+)[\s\.\/-]+(\d{2,4})/,
                    ) ||
                    dateLine.match(
                        /(?:วันที่|วนท|วันท)[\s:]*(\d{1,2})[\s\.\/-]+([ก-๙a-zA-Z0-9\.\-]+)[\s\.\/-]+(\d{2,4})/,
                    );
                if (fullMatch) {
                    const d = parseInt(fullMatch[1]);
                    const mStr = fullMatch[2]
                        .toLowerCase()
                        .replace(/[\.\s\-]/g, "");
                    const yRaw = parseInt(fullMatch[3]);
                    let m = thaiMonthMap[mStr];
                    if (!m) {
                        for (const [key, val] of Object.entries(thaiMonthMap)) {
                            if (
                                mStr.length >= 2 &&
                                (mStr.startsWith(key) ||
                                    key.startsWith(mStr) ||
                                    mStr.includes(key))
                            ) {
                                m = val;
                                break;
                            }
                        }
                    }
                    if (!m) {
                        if (
                            (mStr.includes("m") ||
                                mStr.includes("n") ||
                                mStr.includes("k") ||
                                mStr.includes("h")) &&
                            (mStr.includes("5") ||
                                mStr.includes("s") ||
                                mStr.includes("8"))
                        )
                            m = 12;
                        if (mStr.includes("ค") || mStr.includes("ธ")) m = 12;
                        if (
                            mStr.includes("ม") &&
                            (mStr.includes("ค") || mStr.length <= 3)
                        )
                            m = 1;
                    }
                    if (m && d >= 1 && d <= 31) {
                        let finalYear = yRaw;
                        if (finalYear > 2500) finalYear -= 543;
                        else if (finalYear < 100) {
                            if (finalYear > 40)
                                finalYear = 2500 + finalYear - 543;
                            else finalYear = 2000 + finalYear;
                        }
                        if (finalYear >= 2000 && finalYear <= 2100) {
                            const pad = (n: number) =>
                                String(n).padStart(2, "0");
                            paidAt = `${finalYear}-${pad(m)}-${pad(d)}`;
                        }
                    }
                }
            }

            // --- 3. Extract Note/Memo ---
            let extractedNote = "";
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
            if (!extractedNote) {
                for (let i = lines.length - 1; i >= 0; i--) {
                    const line = lines[i].trim();
                    const noteMatch = line.match(/ค่า[ก-๙a-zA-Z]+/);
                    if (noteMatch) {
                        extractedNote = noteMatch[0];
                        break;
                    }
                }
            }
            if (extractedNote) {
                notes = extractedNote;
                description = extractedNote;
            }
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
            if (files[0]) processOCR(files[0]);

            files.forEach((file) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (e.target?.result)
                        previewUrls = [
                            ...previewUrls,
                            e.target.result as string,
                        ];
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

<div class="max-w-md mx-auto">
    <div class="flex items-center gap-2 mb-8">
        <a
            href="/expenses"
            class="p-2 text-slate-400 hover:text-slate-900 transition-colors"
        >
            <ChevronLeft size={24} />
        </a>
        <h1 class="text-2xl font-black text-slate-900 font-display">
            เพิ่มรายการใหม่
        </h1>
    </div>

    {#if form?.error}
        <div
            class="bg-rose-50 text-rose-600 p-4 rounded-2xl mb-6 text-sm font-medium border border-rose-100"
            in:slide
        >
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
        class="space-y-6"
    >
        <!-- Type Toggle -->
        <div
            class="bg-white p-1 rounded-2xl border border-slate-100 shadow-sm flex premium-shadow"
        >
            <label class="flex-1 cursor-pointer">
                <input
                    type="radio"
                    name="transaction_type"
                    value="income"
                    bind:group={transactionType}
                    class="sr-only"
                />
                <div
                    class="flex items-center justify-center gap-2 py-3 rounded-xl transition-all duration-300 {transactionType ===
                    'income'
                        ? 'bg-emerald-50 text-emerald-600 font-bold shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'}"
                >
                    <ArrowDownLeft size={20} />
                    <span class="text-sm">รายรับ</span>
                </div>
            </label>
            <label class="flex-1 cursor-pointer">
                <input
                    type="radio"
                    name="transaction_type"
                    value="expense"
                    bind:group={transactionType}
                    class="sr-only"
                />
                <div
                    class="flex items-center justify-center gap-2 py-3 rounded-xl transition-all duration-300 {transactionType ===
                    'expense'
                        ? 'bg-rose-50 text-rose-600 font-bold shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'}"
                >
                    <ArrowUpRight size={20} />
                    <span class="text-sm">รายจ่าย</span>
                </div>
            </label>
        </div>

        <div
            class="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm space-y-5"
        >
            <!-- Project Selection -->
            <div>
                <label
                    for="project_id"
                    class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1"
                    >โปรเจค</label
                >
                <select
                    name="project_id"
                    id="project_id"
                    required
                    class="w-full bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500/20 py-3 px-4 text-sm font-bold"
                    value={data.projects.find((p) => p.name === "กองกลาง")
                        ?.id || data.projects[0]?.id}
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
                    class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1"
                >
                    {transactionType === "expense"
                        ? "วันที่จ่าย"
                        : "วันที่รับเงิน"}
                </label>
                <input
                    type="date"
                    name="paid_at"
                    id="paid_at"
                    required
                    bind:value={paidAt}
                    class="w-full bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500/20 py-3 px-4 text-sm font-bold transition-all {scanning
                        ? 'text-indigo-600'
                        : ''}"
                />
            </div>

            <!-- Person -->
            <div>
                <label
                    for="paid_by"
                    class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1"
                >
                    {transactionType === "expense"
                        ? "ผู้สำรองจ่าย"
                        : "ผู้รับเงิน"}
                </label>
                <select
                    name="paid_by"
                    id="paid_by"
                    required
                    class="w-full bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500/20 py-3 px-4 text-sm font-bold"
                >
                    {#each data.profiles as profile}
                        <option value={profile.id}
                            >{profile.display_name}</option
                        >
                    {/each}
                </select>
            </div>

            <!-- Amount -->
            <div>
                <label
                    for="amount"
                    class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1"
                    >จำนวนเงิน (บาท)</label
                >
                <div class="relative">
                    <input
                        type="number"
                        name="amount"
                        id="amount"
                        required
                        min="0"
                        step="0.01"
                        bind:value={amount}
                        class="w-full bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500/20 py-4 px-4 text-2xl font-black font-display tracking-tight transition-all {scanning
                            ? 'bg-indigo-50 animate-pulse text-indigo-600'
                            : ''}"
                        placeholder="0.00"
                    />
                    <div
                        class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 font-bold"
                    >
                        ฿
                    </div>
                </div>
            </div>

            <!-- Category -->
            <div>
                <label
                    for="category"
                    class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1"
                    >หมวดหมู่</label
                >
                <select
                    id="category-select"
                    bind:value={category}
                    on:change={(e) => {
                        if (e.currentTarget.value === "custom")
                            isCustomCategory = true;
                        else {
                            isCustomCategory = false;
                            customCategory = "";
                        }
                    }}
                    class="w-full bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500/20 py-3 px-4 text-sm font-bold"
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
                        class="w-full mt-2 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500/20 py-3 px-4 text-sm font-bold"
                        in:slide
                    />
                {/if}
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
                    class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1"
                    >รายละเอียด</label
                >
                <input
                    type="text"
                    name="description"
                    id="description"
                    required
                    bind:value={description}
                    class="w-full bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500/20 py-3 px-4 text-sm font-bold"
                    placeholder="จ่ายค่าอะไร..."
                />
            </div>

            <!-- Note -->
            <div>
                <label
                    for="notes"
                    class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1"
                    >หมายเหตุ (ไม่บังคับ)</label
                >
                <textarea
                    name="notes"
                    id="notes"
                    bind:value={notes}
                    class="w-full bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500/20 py-3 px-4 text-sm font-medium min-h-[80px]"
                    placeholder="รายละเอียดเพิ่มเติม..."
                ></textarea>
            </div>
        </div>

        <!-- Proof Images -->
        <div
            class="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm space-y-4"
        >
            <div class="flex items-center justify-between">
                <label
                    class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1"
                    >รูปหลักฐาน / สลิป</label
                >
                {#if scanning}
                    <div
                        class="flex items-center gap-1.5 text-indigo-600 text-[10px] font-black uppercase tracking-widest"
                        in:fade
                    >
                        <Sparkles size={14} class="animate-pulse" /> AI Processing...
                    </div>
                {/if}
            </div>

            <div class="relative group">
                <input
                    type="file"
                    name="proof_images"
                    id="proof_images"
                    accept="image/png, image/jpeg"
                    multiple
                    on:change={handleFileChange}
                    class="sr-only"
                />
                <label
                    for="proof_images"
                    class="w-full border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-all duration-300 group-active:scale-95"
                >
                    <div
                        class="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-100 transition-colors"
                    >
                        {#if scanning}
                            <ScanLine class="animate-spin" size={24} />
                        {:else}
                            <ImageIcon size={24} />
                        {/if}
                    </div>
                    <div class="text-center">
                        <div class="text-sm font-bold text-slate-900">
                            อัพโหลดรูปสลิป
                        </div>
                        <p
                            class="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-tighter"
                        >
                            AI จะช่วยกรอกข้อมูลให้อัตโนมัติ
                        </p>
                    </div>
                </label>
            </div>

            {#if previewUrls.length > 0}
                <div class="grid grid-cols-3 gap-3" in:slide>
                    {#each previewUrls as url, i}
                        <div
                            class="relative aspect-square rounded-2xl overflow-hidden border border-slate-100 shadow-sm group/img"
                            in:scale
                        >
                            <img
                                src={url}
                                alt="Preview {i}"
                                class="w-full h-full object-cover"
                            />
                            <div
                                class="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center"
                            >
                                <button
                                    type="button"
                                    class="text-white text-[10px] font-bold"
                                    on:click={() => {
                                        previewUrls = previewUrls.filter(
                                            (_, idx) => idx !== i,
                                        );
                                        if (previewUrls.length === 0) {
                                            const input =
                                                document.getElementById(
                                                    "proof_images",
                                                ) as HTMLInputElement;
                                            if (input) input.value = "";
                                        }
                                    }}>Remove</button
                                >
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>

        <!-- Is Reimbursed (Only for Expense) -->
        {#if transactionType === "expense"}
            <label
                class="flex items-center gap-3 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50 cursor-pointer group active:scale-95 transition-transform"
            >
                <div class="relative flex items-center">
                    <input
                        type="checkbox"
                        name="is_reimbursed"
                        id="is_reimbursed"
                        class="w-6 h-6 rounded-lg text-indigo-600 border-none bg-white focus:ring-0 focus:ring-offset-0 checked:bg-indigo-600"
                    />
                </div>
                <div class="flex-1">
                    <div class="text-sm font-bold text-indigo-900">
                        เคลียร์เงินเรียบร้อยแล้ว
                    </div>
                    <p
                        class="text-[10px] text-indigo-600/60 font-medium tracking-tight"
                    >
                        ทำเครื่องหมายว่ารายการนี้ได้รับการชำระคืนแล้ว
                    </p>
                </div>
            </label>
        {/if}

        <!-- Actions -->
        <div class="flex gap-4 pt-4 pb-20">
            <button
                type="submit"
                disabled={loading || scanning}
                class="flex-1 bg-indigo-600 text-white py-4 rounded-[22px] font-black font-display tracking-tight hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all flex justify-center items-center gap-3 disabled:opacity-50"
            >
                {#if loading}
                    <Loader2 class="animate-spin" size={24} />
                    <span>กำลังบันทึก...</span>
                {:else}
                    <Sparkles size={20} /> <span>บันทึกรายการ</span>
                {/if}
            </button>
        </div>
    </form>
</div>
