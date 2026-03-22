<script lang="ts">
    import { enhance } from "$app/forms";
    import {
        ArrowDownLeft,
        ArrowUpRight,
        ChevronLeft,
        Image as ImageIcon,
        Loader2,
        ScanLine,
        Sparkles,
    } from "lucide-svelte";
    import { fade, slide } from "svelte/transition";
    import { getOCRWorker } from "$lib/stores/ocrStore";
    import { preprocessImage } from "$lib/utils/imageProcessor";
    import {
        extractExpenseData,
        expenseCategories,
        getTodayLocalDate,
        incomeCategories,
    } from "$lib/utils/expenseForm";

    export let data;
    export let form;

    let loading = false;
    let scanning = false;
    let transactionType: "expense" | "income" = "expense";
    let paidAt = getTodayLocalDate();
    let previewUrls: string[] = [];
    let amount: number | null = null;
    let notes = "";
    let description = "";
    let category = "";
    let customCategory = "";
    let isCustomCategory = false;
    let highlightedFields: string[] = [];
    let resetHighlightTimer: ReturnType<typeof setTimeout> | null = null;

    $: availableCategories = transactionType === "income" ? incomeCategories : expenseCategories;
    $: submittedCategory = isCustomCategory ? customCategory : category;

    function flashHighlights(fields: string[]) {
        highlightedFields = fields;
        if (resetHighlightTimer) clearTimeout(resetHighlightTimer);
        resetHighlightTimer = setTimeout(() => {
            highlightedFields = [];
        }, 2200);
    }

    function isHighlighted(field: string) {
        return highlightedFields.includes(field);
    }

    async function processOCR(file: File) {
        scanning = true;

        try {
            const worker = await getOCRWorker();
            const processedImageUrl = await preprocessImage(file);
            const {
                data: { text },
            } = await worker.recognize(processedImageUrl);
            const extracted = extractExpenseData(text);

            if (extracted.amount) amount = extracted.amount;
            if (extracted.date) paidAt = extracted.date;
            if (extracted.notes) {
                notes = extracted.notes;
                description = extracted.description;
            }

            flashHighlights(extracted.highlightedFields);
        } catch (error) {
            console.error("OCR Error:", error);
        } finally {
            scanning = false;
        }
    }

    function handleFileChange(event: Event) {
        const input = event.target as HTMLInputElement;
        previewUrls = [];

        if (!input.files?.length) return;

        const files = Array.from(input.files);
        if (files[0]) {
            processOCR(files[0]);
        }

        files.forEach((file) => {
            const reader = new FileReader();
            reader.onload = (loadEvent) => {
                if (loadEvent.target?.result) {
                    previewUrls = [...previewUrls, loadEvent.target.result as string];
                }
            };
            reader.readAsDataURL(file);
        });
    }
</script>

<div class="page-shell pb-40">
    <div class="flex items-center gap-3 px-1">
        <a
            href="/expenses"
            class="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500"
        >
            <ChevronLeft size={20} />
        </a>
        <div>
            <p class="eyebrow">Entry</p>
            <h1 class="text-2xl font-black text-slate-900 font-display">เพิ่มรายการใหม่</h1>
        </div>
    </div>

    {#if form?.error}
        <div class="surface-card border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700" in:slide>
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
        class="space-y-5"
    >
        <section class="surface-card p-2">
            <div class="grid grid-cols-2 gap-2">
                <label class="cursor-pointer">
                    <input type="radio" class="sr-only" name="transaction_type" value="expense" bind:group={transactionType} />
                    <div class={`flex items-center justify-center gap-2 rounded-[20px] px-4 py-3 text-sm font-bold transition ${
                        transactionType === "expense" ? "bg-slate-900 text-white" : "bg-white text-slate-500"
                    }`}>
                        <ArrowUpRight size={18} />
                        รายจ่าย
                    </div>
                </label>
                <label class="cursor-pointer">
                    <input type="radio" class="sr-only" name="transaction_type" value="income" bind:group={transactionType} />
                    <div class={`flex items-center justify-center gap-2 rounded-[20px] px-4 py-3 text-sm font-bold transition ${
                        transactionType === "income" ? "bg-emerald-600 text-white" : "bg-white text-slate-500"
                    }`}>
                        <ArrowDownLeft size={18} />
                        รายรับ
                    </div>
                </label>
            </div>
        </section>

        <section class="surface-card p-5">
            <div class="mb-3 flex items-center justify-between">
                <div>
                    <h2 class="text-lg font-black text-slate-900 font-display">จำนวนเงิน</h2>
                    <p class="text-sm text-slate-500">เริ่มจากตัวเลขก่อน แล้วค่อยเติมรายละเอียดอื่น</p>
                </div>
                {#if scanning}
                    <div class="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700" in:fade>
                        <Sparkles size={13} class="animate-pulse" />
                        AI กำลังอ่านสลิป
                    </div>
                {/if}
            </div>

            <label class="field-label" for="amount">จำนวนเงิน (บาท)</label>
            <div class="relative">
                <input
                    id="amount"
                    name="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    bind:value={amount}
                    class={`field-input-hero pr-14 ${isHighlighted("amount") ? "border-indigo-300 bg-indigo-50 text-indigo-700" : ""}`}
                    placeholder="0.00"
                />
                <span class="absolute right-5 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-300">฿</span>
            </div>
        </section>

        <section class="surface-card p-5">
            <div class="mb-4">
                <h2 class="text-lg font-black text-slate-900 font-display">หลักฐาน / สลิป</h2>
                <p class="text-sm text-slate-500">แนบรูปถ้ามี ระบบจะพยายามช่วยเติมจำนวนเงิน วันที่ และ memo ให้</p>
            </div>

            <input
                type="file"
                name="proof_images"
                id="proof_images"
                accept="image/png, image/jpeg, image/webp, image/heic"
                multiple
                class="sr-only"
                on:change={handleFileChange}
            />

            <label
                for="proof_images"
                class="flex cursor-pointer flex-col items-center gap-3 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center transition hover:border-indigo-300 hover:bg-indigo-50"
            >
                <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm">
                    {#if scanning}
                        <ScanLine size={22} class="animate-spin" />
                    {:else}
                        <ImageIcon size={22} />
                    {/if}
                </div>
                <div>
                    <div class="text-base font-bold text-slate-900">อัปโหลดรูปสลิป</div>
                    <p class="mt-1 text-sm text-slate-500">ยังกรอกมือได้ครบถ้วนเสมอ แม้ OCR จะอ่านไม่สำเร็จ</p>
                </div>
            </label>

            {#if previewUrls.length > 0}
                <div class="mt-4 grid grid-cols-3 gap-3" in:slide>
                    {#each previewUrls as url, index}
                        <div class="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                            <img src={url} alt={`Proof preview ${index + 1}`} class="h-24 w-full object-cover" />
                        </div>
                    {/each}
                </div>
            {/if}
        </section>

        <section class="surface-card p-5">
            <div class="mb-4">
                <h2 class="text-lg font-black text-slate-900 font-display">รายละเอียดรายการ</h2>
                <p class="text-sm text-slate-500">สิ่งสำคัญอยู่ด้านบนแล้ว ส่วนนี้ไว้เติม context ให้หาเจอง่ายในภายหลัง</p>
            </div>

            <div class="space-y-4">
                <div>
                    <label class="field-label" for="description">รายละเอียด</label>
                    <input
                        id="description"
                        name="description"
                        type="text"
                        required
                        bind:value={description}
                        class={`field-input ${isHighlighted("description") ? "border-indigo-300 bg-indigo-50" : ""}`}
                        placeholder="จ่ายค่าอะไร"
                    />
                </div>

                <div>
                    <label class="field-label" for="project_id">โปรเจค</label>
                    <select
                        id="project_id"
                        name="project_id"
                        required
                        class="field-input"
                        value={data.projects.find((project) => project.name === "กองกลาง")?.id || data.projects[0]?.id}
                    >
                        {#each data.projects as project}
                            <option value={project.id}>{project.name}</option>
                        {/each}
                    </select>
                </div>

                <div>
                    <label class="field-label" for="paid_at">{transactionType === "expense" ? "วันที่จ่าย" : "วันที่รับเงิน"}</label>
                    <input
                        id="paid_at"
                        name="paid_at"
                        type="date"
                        required
                        bind:value={paidAt}
                        class={`field-input ${isHighlighted("date") ? "border-indigo-300 bg-indigo-50" : ""}`}
                    />
                </div>

                <div>
                    <label class="field-label" for="category-select">หมวดหมู่</label>
                    <select
                        id="category-select"
                        bind:value={category}
                        class="field-input"
                        on:change={(event) => {
                            const value = (event.currentTarget as HTMLSelectElement).value;
                            if (value === "custom") {
                                isCustomCategory = true;
                            } else {
                                isCustomCategory = false;
                                customCategory = "";
                            }
                        }}
                    >
                        <option value="">เลือกหมวดหมู่</option>
                        {#each availableCategories as item}
                            <option value={item}>{item}</option>
                        {/each}
                        <option value="custom">พิมพ์หมวดหมู่เอง</option>
                    </select>
                    {#if isCustomCategory}
                        <input
                            type="text"
                            bind:value={customCategory}
                            class="field-input mt-3"
                            placeholder="หมวดหมู่ที่ต้องการใช้"
                        />
                    {/if}
                    <input type="hidden" name="category" value={submittedCategory} />
                </div>

                <div>
                    <label class="field-label" for="notes">หมายเหตุ (ไม่บังคับ)</label>
                    <textarea
                        id="notes"
                        name="notes"
                        bind:value={notes}
                        class={`field-input min-h-[96px] ${isHighlighted("notes") ? "border-indigo-300 bg-indigo-50" : ""}`}
                        placeholder="เช่น รายละเอียดจาก memo หรือ context เพิ่มเติม"
                    ></textarea>
                </div>

                <input type="hidden" name="paid_by" value={data.currentProfileId || ""} />
                <div>
                    <div class="field-label">{transactionType === "expense" ? "ผู้สำรองจ่าย" : "ผู้รับเงิน"}</div>
                    <div class="identity-chip">
                        {#if data.currentUser?.avatar_url}
                            <img
                                src={data.currentUser.avatar_url}
                                alt=""
                                class="h-8 w-8 rounded-full object-cover"
                                referrerpolicy="no-referrer"
                            />
                        {/if}
                        <div>
                            <div class="font-semibold text-slate-800">{data.currentUser?.name || "ไม่พบโปรไฟล์"}</div>
                            <div class="text-xs text-slate-500">ล็อกตามบัญชีที่กำลังใช้งานอยู่</div>
                        </div>
                    </div>
                </div>

                {#if transactionType === "expense"}
                    <label class="flex cursor-pointer items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                        <input
                            type="checkbox"
                            name="is_reimbursed"
                            id="is_reimbursed"
                            class="mt-1 h-5 w-5 rounded border-amber-300 text-indigo-600"
                        />
                        <div>
                            <div class="text-sm font-bold text-amber-900">รายการนี้เคลียร์แล้ว</div>
                            <p class="mt-1 text-sm text-amber-700">ใช้เฉพาะกรณีที่มีการโอนคืนครบแล้วตั้งแต่ก่อนบันทึก</p>
                        </div>
                    </label>
                {/if}
            </div>
        </section>

        <div class="sticky-action-bar">
            <div class="mx-auto flex max-w-md gap-3">
                <a href="/expenses" class="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-600">
                    ยกเลิก
                </a>
                <button
                    type="submit"
                    disabled={loading || scanning}
                    class="flex flex-[1.3] items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                    {#if loading}
                        <Loader2 size={18} class="animate-spin" />
                        กำลังบันทึก...
                    {:else}
                        บันทึกรายการ
                    {/if}
                </button>
            </div>
        </div>
    </form>
</div>
