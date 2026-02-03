<script lang="ts">
    import { enhance } from "$app/forms";
    import {
        Loader2,
        ArrowUpRight,
        ArrowDownLeft,
        ScanLine,
        Plus,
        Trash2,
        ArrowLeft,
        Upload,
        AlertCircle,
        X,
        Save,
    } from "lucide-svelte";
    import { createWorker } from "tesseract.js";
    import { onMount } from "svelte";
    import { preprocessImage } from "$lib/utils/imageProcessor";

    export let data;
    export let form;

    let loading = false;
    let selectedPreview: string | null = null;
    let items: any[] = [];
    let isProcessing = false;

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

    // Helper to extract data from OCR text (simplified from new/+page.svelte)
    function extractData(text: string) {
        const lines = text.split("\n");
        let amount = null;
        let date = "";
        let notes = "";

        // --- 1. Extract Amount ---
        // Handle both same-line and next-line patterns

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Pattern 1: "จำนวน: 88.00" or "จำนวน 88.00" on same line
            const sameLineMatch = line.match(
                /(?:จำนวน|จํานวน)\s*[:.]?\s*([\d,]+\.?\d*)/i,
            );
            if (sameLineMatch && sameLineMatch[1]) {
                const val = parseFloat(sameLineMatch[1].replace(/,/g, ""));
                if (!isNaN(val) && val > 0) {
                    amount = val;
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
                        amount = val;
                        break;
                    }
                }
            }
        }

        // Fallback: Find "XX.XX บาท" but skip fee lines
        if (!amount) {
            for (let line of lines) {
                if (line.match(/ค่าธรรมเนียม|fee/i)) continue;
                const match = line.match(/([\d,]+\.\d{2})\s*(?:บาท|THB)/i);
                if (match) {
                    const val = parseFloat(match[1].replace(/,/g, ""));
                    if (!isNaN(val) && val > 0) {
                        amount = val;
                        break;
                    }
                }
            }
        }

        // --- 2. Extract Date ---
        // KBank format: "6 ม.ค. 69" or "31 ธ.ค. 68"
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
        };

        for (let line of lines) {
            // Match: day + thai/eng month + year (2 or 4 digits)
            const dateMatch = line.match(
                /(\d{1,2})\s*([ก-๙a-zA-Z\.]+)\s*(\d{2,4})/,
            );
            if (dateMatch) {
                const day = parseInt(dateMatch[1]);
                const monthStr = dateMatch[2]
                    .toLowerCase()
                    .replace(/[\.\s]/g, "");
                const yearRaw = parseInt(dateMatch[3]);

                // Try to find month (direct match first)
                let month = thaiMonthMap[monthStr];

                // If not found, try partial match
                if (!month) {
                    for (const [key, val] of Object.entries(thaiMonthMap)) {
                        if (monthStr.includes(key) || key.includes(monthStr)) {
                            month = val;
                            break;
                        }
                    }
                }

                if (month && day >= 1 && day <= 31) {
                    // Convert BE to AD if needed
                    let year = yearRaw;
                    if (yearRaw > 2500) {
                        year = yearRaw - 543; // Full BE year
                    } else if (yearRaw < 100) {
                        // Short year: 69 -> BE 2569 -> AD 2026
                        if (yearRaw > 40) {
                            year = 2500 + yearRaw - 543;
                        } else {
                            year = 2000 + yearRaw;
                        }
                    }

                    // Validate Year Range (e.g. 2000 - 2100)
                    if (year >= 2000 && year <= 2100) {
                        const pad = (n: number) => String(n).padStart(2, "0");
                        date = `${year}-${pad(month)}-${pad(day)}`;
                        break;
                    }
                }
            }
        }

        if (!date) {
            date = new Date().toISOString().split("T")[0];
        }

        // --- 3. Extract Note/Memo ---
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const noteLabelMatch = line.match(
                /(?:บันทึกช่วยจำ|บันทึกช่วยจํา|Note|Memo)/i,
            );
            if (noteLabelMatch) {
                let content = line
                    .substring(noteLabelMatch.index! + noteLabelMatch[0].length)
                    .replace(/^[:.\s]+/, "")
                    .trim();
                if (!content && i + 1 < lines.length)
                    content = lines[i + 1].trim();
                if (content) {
                    notes = content;
                    break;
                }
            }
        }

        return { amount, notes, date };
    }

    async function processFiles(files: FileList) {
        isProcessing = true;
        const worker = await createWorker("tha+eng");

        // Find "กองกลาง" project ID
        const defaultProject =
            data.projects.find((p) => p.name === "กองกลาง") || data.projects[0];
        const defaultProjectId = defaultProject?.id || "";

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const previewUrl = URL.createObjectURL(file); // Keep original for user preview

            // Initial item state
            const newItem = {
                file,
                previewUrl,
                status: "scanning",
                amount: null,
                notes: "",
                description: "",
                date: new Date().toISOString().split("T")[0],
                category: "",
                projectId: defaultProjectId,
                paidBy: data.profiles[0]?.id || "",
                transactionType: "expense",
            };

            items = [...items, newItem];
            const currentIndex = items.length - 1;

            try {
                // Preprocess for OCR
                const processedImageUrl = await preprocessImage(file);

                // Run OCR with processed image
                const {
                    data: { text },
                } = await worker.recognize(processedImageUrl);

                console.log(`OCR Raw Text [${i}]:`, text);
                const extracted = extractData(text);
                console.log(`Extracted [${i}]:`, extracted);

                items[currentIndex] = {
                    ...items[currentIndex],
                    ...extracted,
                    status: "ready",
                    description:
                        extracted.notes || items[currentIndex].description,
                };
            } catch (err) {
                console.error("OCR Error:", err);
                items[currentIndex].status = "error";
            }
        }

        await worker.terminate();
        isProcessing = false;
    }

    function handleFileChange(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files) {
            processFiles(input.files);
        }
    }

    function removeItem(index: number) {
        items = items.filter((_, i) => i !== index);
    }
</script>

<div class="max-w-3xl mx-auto pb-20">
    <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-3">
            <a
                href="/expenses"
                class="p-2 -ml-2 text-gray-500 hover:text-gray-900 transition rounded-full hover:bg-gray-100"
            >
                <ArrowLeft size={24} />
            </a>
            <h1 class="text-2xl font-bold text-gray-800">
                บันทึกสลิปหลายรายการ
            </h1>
        </div>

        <div class="flex items-center gap-2">
            {#if items.length > 0}
                <button
                    type="submit"
                    form="bulk-save-form"
                    disabled={loading || isProcessing}
                    class="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition shadow-sm text-sm flex items-center gap-2 disabled:opacity-50"
                >
                    {#if loading}
                        <Loader2 class="animate-spin" size={18} />
                    {:else}
                        <Save size={18} />
                    {/if}
                    บันทึก
                </button>
            {/if}

            <label
                class="cursor-pointer bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition shadow-sm text-sm flex items-center gap-2"
            >
                <Plus size={18} /> เพิ่มสลิป
                <input
                    type="file"
                    multiple
                    accept="image/*"
                    class="hidden"
                    on:change={handleFileChange}
                />
            </label>
        </div>
    </div>

    {#if form?.error}
        <div
            class="bg-red-50 text-red-600 p-4 rounded-lg mb-6 text-sm flex items-start gap-2"
        >
            <AlertCircle size={18} class="shrink-0 mt-0.5" />
            <span>{form.error}</span>
        </div>
    {/if}

    {#if items.length === 0}
        <div
            class="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center"
        >
            <div
                class="bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            >
                <Upload class="text-indigo-600" size={32} />
            </div>
            <h3 class="text-lg font-medium text-gray-900 mb-1">ยังไม่มีสลิป</h3>
            <p class="text-gray-500 mb-6">
                อัพโหลดรูปสลิปธนาคารเพื่อบันทึกรายการอัตโนมัติ
            </p>
            <label
                class="cursor-pointer bg-gray-100 text-gray-700 px-6 py-2.5 rounded-lg font-bold hover:bg-gray-200 transition inline-block"
            >
                เลือกรูปหลายสลิป
                <input
                    type="file"
                    multiple
                    accept="image/*"
                    class="hidden"
                    on:change={handleFileChange}
                />
            </label>
        </div>
    {:else}
        <form
            id="bulk-save-form"
            method="POST"
            action="?/batchSave"
            enctype="multipart/form-data"
            use:enhance={({ formData }) => {
                loading = true;
                // Append files from local state because <input type="file"> is tricky to bind individually in a loop
                items.forEach((item, i) => {
                    if (item.file) {
                        formData.append(`item_${i}_file`, item.file);
                    }
                });
                return async ({ update }) => {
                    loading = false;
                    update();
                };
            }}
            class="space-y-4"
        >
            <input type="hidden" name="item_count" value={items.length} />

            <div class="grid gap-4">
                {#each items as item, i}
                    <div
                        class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-6 relative group"
                    >
                        <button
                            type="button"
                            on:click={() => removeItem(i)}
                            class="absolute -top-2 -right-2 bg-red-100 text-red-600 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition shadow-sm hover:bg-red-200"
                        >
                            <Trash2 size={16} />
                        </button>

                        <!-- Preview & OCR Status -->
                        <div class="w-full md:w-32 shrink-0">
                            <button
                                type="button"
                                class="relative aspect-square md:aspect-[3/4] rounded-lg overflow-hidden border border-gray-100 bg-gray-50 w-full block cursor-zoom-in group/img"
                                on:click={() =>
                                    (selectedPreview = item.previewUrl)}
                            >
                                <img
                                    src={item.previewUrl}
                                    alt="Slip"
                                    class="w-full h-full object-cover transition duration-300 group-hover/img:scale-105"
                                />
                                {#if item.status === "scanning"}
                                    <div
                                        class="absolute inset-0 bg-indigo-600/20 backdrop-blur-[2px] flex flex-col items-center justify-center text-white p-2 text-center"
                                    >
                                        <Loader2
                                            class="animate-spin mb-1"
                                            size={24}
                                        />
                                        <span class="text-[10px] font-bold"
                                            >Scanning...</span
                                        >
                                    </div>
                                {/if}
                            </button>
                        </div>

                        <!-- Data Fields -->
                        <div
                            class="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                        >
                            <input
                                type="hidden"
                                name="item_{i}_transaction_type"
                                value={item.transactionType}
                            />
                            <input
                                type="file"
                                name="item_{i}_file"
                                class="hidden"
                            />
                            <!-- Need to pass the file somehow to FormData without browser security blocks, 
                                 Actually the cleanest way is to use JS to submit, but with SvelteKit enhance 
                                 we can manually append files. Let's adjust enhance below. -->

                            <!-- Amount -->
                            <div class="md:col-span-1">
                                <label
                                    class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1"
                                    >จำนวนเงิน</label
                                >
                                <div class="relative">
                                    <input
                                        type="number"
                                        name="item_{i}_amount"
                                        step="0.01"
                                        bind:value={item.amount}
                                        class="w-full border-gray-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 font-bold"
                                        placeholder="0.00"
                                    />
                                    <span
                                        class="absolute right-3 top-2.5 text-gray-400 text-sm"
                                        >฿</span
                                    >
                                </div>
                            </div>

                            <!-- Date -->
                            <div>
                                <label
                                    class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1"
                                    >วันที่</label
                                >
                                <input
                                    type="date"
                                    name="item_{i}_date"
                                    bind:value={item.date}
                                    class="w-full border-gray-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                />
                            </div>

                            <!-- Category -->
                            <div>
                                <label
                                    class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1"
                                    >หมวดหมู่</label
                                >
                                <select
                                    name="item_{i}_category"
                                    bind:value={item.category}
                                    class="w-full border-gray-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                >
                                    <option value="">-- เลือก --</option>
                                    {#each expenseCategories as cat}
                                        <option value={cat}>{cat}</option>
                                    {/each}
                                </select>
                            </div>

                            <!-- Project -->
                            <div>
                                <label
                                    class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1"
                                    >โปรเจค</label
                                >
                                <select
                                    name="item_{i}_project_id"
                                    bind:value={item.projectId}
                                    class="w-full border-gray-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                >
                                    {#each data.projects as project}
                                        <option value={project.id}
                                            >{project.name}</option
                                        >
                                    {/each}
                                </select>
                            </div>

                            <!-- Paid By -->
                            <div>
                                <label
                                    class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1"
                                    >ผู้จ่าย</label
                                >
                                <select
                                    name="item_{i}_paid_by"
                                    bind:value={item.paidBy}
                                    class="w-full border-gray-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                >
                                    {#each data.profiles as profile}
                                        <option value={profile.id}
                                            >{profile.display_name}</option
                                        >
                                    {/each}
                                </select>
                            </div>

                            <!-- Description -->
                            <div class="md:col-span-full">
                                <label
                                    class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1"
                                    >รายละเอียด/หมายเหตุ</label
                                >
                                <input
                                    type="text"
                                    name="item_{i}_description"
                                    bind:value={item.description}
                                    class="w-full border-gray-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                    placeholder="ใส่รายละเอียด..."
                                />
                                <input
                                    type="hidden"
                                    name="item_{i}_notes"
                                    value={item.notes}
                                />
                            </div>
                        </div>
                    </div>
                {/each}
            </div>

            <!-- Sticky Footer for Actions -->
            <div
                class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-20"
            >
                <div class="max-w-3xl mx-auto flex gap-3">
                    <button
                        type="button"
                        on:click={() => (items = [])}
                        class="px-6 py-3 border border-gray-200 rounded-xl text-gray-600 font-medium hover:bg-gray-50 transition"
                    >
                        ล้างทั้งหมด
                    </button>
                    <button
                        type="submit"
                        disabled={loading || isProcessing}
                        class="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {#if loading}
                            <Loader2 class="animate-spin" size={20} /> กำลังบันทึก...
                        {:else}
                            <Plus size={20} /> บันทึกรวดเดียว {items.length} รายการ
                        {/if}
                    </button>
                </div>
            </div>
        </form>
    {/if}
</div>

{#if selectedPreview}
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 backdrop-blur-sm"
        on:click={() => (selectedPreview = null)}
        on:keydown={(e) => e.key === "Escape" && (selectedPreview = null)}
        role="button"
        tabindex="0"
    >
        <button
            class="absolute top-4 right-4 text-white/50 hover:text-white transition p-2 hover:bg-white/10 rounded-full"
            on:click={() => (selectedPreview = null)}
        >
            <X size={32} />
        </button>
        <img
            src={selectedPreview}
            alt="Full Preview"
            class="max-w-full max-h-[95vh] object-contain rounded shadow-2xl"
        />
    </div>
{/if}

<style>
    /* Custom scrollbar for better feel */
    :global(body) {
        background-color: #f8fafc;
    }
</style>
