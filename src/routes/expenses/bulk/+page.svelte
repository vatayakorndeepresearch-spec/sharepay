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
        ChevronLeft,
        Sparkles,
    } from "lucide-svelte";
    import { getOCRWorker } from "$lib/stores/ocrStore";
    import { onMount } from "svelte";
    import { preprocessImage } from "$lib/utils/imageProcessor";
    import { fade, slide, scale } from "svelte/transition";

    export let data;
    export let form;

    let loading = false;
    let selectedPreview: string | null = null;
    let items: any[] = [];
    let isProcessing = false;

    // Store files separately to ensure they persist for FormData
    let fileStore: Map<number, File> = new Map();

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
        };

        // Extraction logic matches new/+page.svelte
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
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
        }

        for (let line of lines) {
            const dateMatch = line.match(
                /(\d{1,2})\s*([ก-๙a-zA-Z\.]+)\s*(\d{2,4})/,
            );
            if (dateMatch) {
                const day = parseInt(dateMatch[1]);
                const monthStr = dateMatch[2]
                    .toLowerCase()
                    .replace(/[\.\s]/g, "");
                const yearRaw = parseInt(dateMatch[3]);
                let month = thaiMonthMap[monthStr];
                if (!month) {
                    for (const [key, val] of Object.entries(thaiMonthMap)) {
                        if (monthStr.includes(key) || key.includes(monthStr)) {
                            month = val;
                            break;
                        }
                    }
                }
                if (month && day >= 1 && day <= 31) {
                    let year = yearRaw;
                    if (yearRaw > 2500) year = yearRaw - 543;
                    else if (yearRaw < 100)
                        year =
                            yearRaw > 40
                                ? 2500 + yearRaw - 543
                                : 2000 + yearRaw;
                    if (year >= 2000 && year <= 2100) {
                        const pad = (n: number) => String(n).padStart(2, "0");
                        date = `${year}-${pad(month)}-${pad(day)}`;
                        break;
                    }
                }
            }
        }

        if (!date) date = new Date().toISOString().split("T")[0];

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
        const worker = await getOCRWorker();

        const defaultProject =
            data.projects.find((p) => p.name === "กองกลาง") || data.projects[0];
        const defaultProjectId = defaultProject?.id || "";

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const previewUrl = await new Promise<string>((res) => {
                const r = new FileReader();
                r.onload = (e) => res(e.target?.result as string);
                r.readAsDataURL(file);
            });

            const fileIndex = items.length;
            fileStore.set(fileIndex, file);

            const newItem = {
                fileIndex,
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
                const processedImageUrl = await preprocessImage(file);
                const {
                    data: { text },
                } = await worker.recognize(processedImageUrl);
                const extracted = extractData(text);

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
        isProcessing = false;
    }

    function handleFileChange(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files) processFiles(input.files);
    }

    function removeItem(index: number) {
        const item = items[index];
        if (item && typeof item.fileIndex === "number")
            fileStore.delete(item.fileIndex);
        items = items.filter((_, i) => i !== index);
    }
</script>

<div class="max-w-3xl mx-auto pb-32">
    <div class="flex items-center justify-between mb-8 px-1">
        <div class="flex items-center gap-2">
            <a
                href="/expenses"
                class="p-2 -ml-2 text-slate-400 hover:text-slate-900 transition-colors"
            >
                <ChevronLeft size={24} />
            </a>
            <h1 class="text-2xl font-black text-slate-900 font-display">
                บันทึกหลายรายการ
            </h1>
        </div>

        <div class="flex items-center gap-3">
            <label
                class="cursor-pointer bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-2xl font-bold hover:bg-slate-50 transition shadow-sm text-xs flex items-center gap-2 active:scale-95"
            >
                <Plus size={16} />
                <span class="uppercase tracking-tight">เพิ่มสลิป</span>
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
            class="bg-rose-50 text-rose-600 p-4 rounded-2xl mb-6 text-sm font-medium border border-rose-100 flex items-start gap-2"
        >
            <AlertCircle size={18} class="shrink-0 mt-0.5" />
            <span>{form.error}</span>
        </div>
    {/if}

    {#if items.length === 0}
        <div
            class="bg-white border-2 border-dashed border-slate-200 rounded-[32px] p-16 text-center premium-shadow"
        >
            <div
                class="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-indigo-600"
            >
                <Upload size={40} />
            </div>
            <h3 class="text-xl font-black text-slate-900 mb-2 font-display">
                ยังไม่มีสลิป
            </h3>
            <p
                class="text-slate-500 mb-8 max-w-[240px] mx-auto text-sm font-medium"
            >
                อัพโหลดรูปสลิปธนาคารหลายรูปเพื่อบันทึกรายการอัตโนมัติด้วย AI
            </p>
            <label
                class="cursor-pointer bg-indigo-600 text-white px-8 py-3.5 rounded-2xl font-black tracking-tight hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/20 active:scale-95 inline-block font-display"
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
                items.forEach((item, i) => {
                    const file = fileStore.get(item.fileIndex);
                    if (file && file instanceof File && file.size > 0)
                        formData.append(`item_${i}_file`, file);
                });
                return async ({ result, update }) => {
                    loading = false;
                    if (result.type === "redirect")
                        window.location.href = result.location;
                    else await update();
                };
            }}
            class="space-y-6"
        >
            <input type="hidden" name="item_count" value={items.length} />

            <div class="grid gap-6">
                {#each items as item, i}
                    <div
                        class="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 flex flex-col md:flex-row gap-8 relative group hover:border-indigo-100 transition-colors"
                        in:scale
                    >
                        <button
                            type="button"
                            on:click={() => removeItem(i)}
                            class="absolute -top-3 -right-3 bg-rose-100 text-rose-600 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-md hover:bg-rose-200"
                        >
                            <X size={16} />
                        </button>

                        <div class="w-full md:w-36 shrink-0">
                            <button
                                type="button"
                                class="relative aspect-[3/4] rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 w-full block cursor-zoom-in group/img shadow-inner"
                                on:click={() =>
                                    (selectedPreview = item.previewUrl)}
                            >
                                <img
                                    src={item.previewUrl}
                                    alt="Slip"
                                    class="w-full h-full object-cover transition duration-500 group-hover/img:scale-110"
                                />
                                {#if item.status === "scanning"}
                                    <div
                                        class="absolute inset-0 bg-indigo-600/40 backdrop-blur-md flex flex-col items-center justify-center text-white p-2 text-center"
                                        in:fade
                                    >
                                        <Loader2
                                            class="animate-spin mb-2"
                                            size={32}
                                        />
                                        <span
                                            class="text-[10px] font-black uppercase tracking-widest"
                                            >AI Scanning</span
                                        >
                                    </div>
                                {/if}
                            </button>
                        </div>

                        <div
                            class="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
                        >
                            <input
                                type="hidden"
                                name={`item_${i}_transaction_type`}
                                value={item.transactionType}
                            />

                            <div class="lg:col-span-1">
                                <label
                                    class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1"
                                    >จำนวนเงิน</label
                                >
                                <div class="relative">
                                    <input
                                        type="number"
                                        name={`item_${i}_amount`}
                                        step="0.01"
                                        bind:value={item.amount}
                                        class="w-full bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500/20 py-3 px-4 text-lg font-black font-display tracking-tight {item.status ===
                                        'scanning'
                                            ? 'animate-pulse'
                                            : ''}"
                                        placeholder="0.00"
                                    />
                                    <span
                                        class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 font-bold"
                                        >฿</span
                                    >
                                </div>
                            </div>

                            <div>
                                <label
                                    class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1"
                                    >วันที่</label
                                >
                                <input
                                    type="date"
                                    name={`item_${i}_date`}
                                    bind:value={item.date}
                                    class="w-full bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500/20 py-3 px-4 text-sm font-bold"
                                />
                            </div>

                            <div>
                                <label
                                    class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1"
                                    >หมวดหมู่</label
                                >
                                <select
                                    name={`item_${i}_category`}
                                    bind:value={item.category}
                                    class="w-full bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500/20 py-3 px-4 text-sm font-bold"
                                >
                                    <option value="">-- เลือก --</option>
                                    {#each expenseCategories as cat}
                                        <option value={cat}>{cat}</option>
                                    {/each}
                                </select>
                            </div>

                            <div>
                                <label
                                    class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1"
                                    >โปรเจค</label
                                >
                                <select
                                    name={`item_${i}_project_id`}
                                    bind:value={item.projectId}
                                    class="w-full bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500/20 py-3 px-4 text-sm font-bold"
                                >
                                    {#each data.projects as project}
                                        <option value={project.id}
                                            >{project.name}</option
                                        >
                                    {/each}
                                </select>
                            </div>

                            <div>
                                <label
                                    class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1"
                                    >ผู้จ่าย</label
                                >
                                <select
                                    name={`item_${i}_paid_by`}
                                    bind:value={item.paidBy}
                                    class="w-full bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500/20 py-3 px-4 text-sm font-bold"
                                >
                                    {#each data.profiles as profile}
                                        <option value={profile.id}
                                            >{profile.display_name}</option
                                        >
                                    {/each}
                                </select>
                            </div>

                            <div class="md:col-span-full">
                                <label
                                    class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1"
                                    >รายละเอียด</label
                                >
                                <input
                                    type="text"
                                    name={`item_${i}_description`}
                                    bind:value={item.description}
                                    class="w-full bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500/20 py-3 px-4 text-sm font-bold"
                                    placeholder="ใส่รายละเอียด..."
                                />
                                <input
                                    type="hidden"
                                    name={`item_${i}_notes`}
                                    value={item.notes}
                                />
                            </div>
                        </div>
                    </div>
                {/each}
            </div>

            <div
                class="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-100 p-6 z-30 shadow-[0_-20px_40px_rgba(0,0,0,0.05)]"
            >
                <div class="max-w-3xl mx-auto flex gap-4">
                    <button
                        type="button"
                        on:click={() => (items = [])}
                        class="px-8 py-4 bg-slate-100 rounded-[22px] text-slate-600 font-black tracking-tight hover:bg-slate-200 transition active:scale-95 font-display min-w-[140px]"
                    >
                        ล้างทั้งหมด
                    </button>
                    <button
                        type="submit"
                        disabled={loading || isProcessing}
                        class="flex-1 bg-indigo-600 text-white py-4 rounded-[22px] font-black tracking-tight hover:bg-indigo-700 transition shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 font-display"
                    >
                        {#if loading}
                            <Loader2 class="animate-spin" size={24} />
                            <span>กำลังบันทึก...</span>
                        {:else}
                            <Sparkles size={24} />
                            <span>บันทึก {items.length} รายการ</span>
                        {/if}
                    </button>
                </div>
            </div>
        </form>
    {/if}
</div>

{#if selectedPreview}
    <div
        class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/95 p-4 backdrop-blur-xl"
        on:click={() => (selectedPreview = null)}
        in:fade
        out:fade
    >
        <button
            class="absolute top-6 right-6 text-white/40 hover:text-white transition p-3 bg-white/10 rounded-2xl"
            on:click={() => (selectedPreview = null)}
        >
            <X size={32} />
        </button>
        <img
            src={selectedPreview}
            alt="Full Preview"
            class="max-w-full max-h-[90vh] object-contain rounded-3xl shadow-2xl"
            in:scale
        />
    </div>
{/if}
