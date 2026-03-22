<script lang="ts">
    import { enhance } from "$app/forms";
    import {
        ArrowDownLeft,
        ArrowUpRight,
        ChevronLeft,
        Image as ImageIcon,
        Loader2,
        ScanLine,
        Trash2,
    } from "lucide-svelte";
    import { getOCRWorker } from "$lib/stores/ocrStore";
    import { preprocessImage } from "$lib/utils/imageProcessor";
    import {
        extractExpenseData,
        expenseCategories,
        incomeCategories,
    } from "$lib/utils/expenseForm";

    export let data;
    export let form;

    let loading = false;
    let scanning = false;
    let previewUrls: string[] = [];
    let highlightedFields: string[] = [];
    let resetHighlightTimer: ReturnType<typeof setTimeout> | null = null;

    let transactionType: "expense" | "income" = data.expense.transaction_type || "expense";
    let amount = data.expense.amount;
    let notes = data.expense.notes || "";
    let paidAt = data.expense.paid_at;
    let description = data.expense.description;
    let category = data.expense.category || "";
    let customCategory = "";
    let isCustomCategory = false;

    $: availableCategories = transactionType === "income" ? incomeCategories : expenseCategories;
    $: submittedCategory = isCustomCategory ? customCategory : category;
    $: {
        if (category && !availableCategories.includes(category as never) && category !== "custom") {
            isCustomCategory = true;
            customCategory = category;
            category = "custom";
        }
    }

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
        if (files[0]) processOCR(files[0]);

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
            href={`/expenses/${data.expense.id}`}
            class="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500"
        >
            <ChevronLeft size={20} />
        </a>
        <div>
            <p class="eyebrow">Edit</p>
            <h1 class="text-2xl font-black text-slate-900 font-display">แก้ไขรายการ</h1>
        </div>
    </div>

    {#if form?.error}
        <div class="surface-card border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
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
                    <p class="text-sm text-slate-500">แก้ยอดให้ถูกก่อน แล้วรายการย่อยจะตามมาเอง</p>
                </div>
                {#if scanning}
                    <div class="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                        <ScanLine size={13} class="animate-spin" />
                        กำลังอ่านสลิป
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
                />
                <span class="absolute right-5 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-300">฿</span>
            </div>
        </section>

        <section class="surface-card p-5">
            <div class="mb-4">
                <h2 class="text-lg font-black text-slate-900 font-display">หลักฐาน / สลิป</h2>
                <p class="text-sm text-slate-500">เพิ่มรูปใหม่ได้ และระบบจะช่วยเติมข้อมูลจากรูปแรกที่อัปโหลด</p>
            </div>

            <input
                type="file"
                id="proof_images"
                name="proof_images"
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
                    <ImageIcon size={22} />
                </div>
                <div>
                    <div class="text-base font-bold text-slate-900">เพิ่มรูปหลักฐานใหม่</div>
                    <p class="mt-1 text-sm text-slate-500">รูปเดิมยังอยู่จนกว่าจะลบออกเอง</p>
                </div>
            </label>

            {#if previewUrls.length > 0}
                <div class="mt-4 grid grid-cols-3 gap-3">
                    {#each previewUrls as url, index}
                        <div class="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                            <img src={url} alt={`New proof ${index + 1}`} class="h-24 w-full object-cover" />
                        </div>
                    {/each}
                </div>
            {/if}

            {#if data.expense.attachments?.length}
                <div class="mt-5">
                    <div class="mb-3 text-sm font-semibold text-slate-600">รูปที่มีอยู่แล้ว</div>
                    <div class="grid grid-cols-3 gap-3">
                        {#each data.expense.attachments as attachment}
                            <div class="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                                <img src={attachment.file_url} alt="Attachment" class="h-24 w-full object-cover" />
                                <button
                                    type="submit"
                                    formaction="?/deleteAttachment"
                                    name="attachment_id"
                                    value={attachment.id}
                                    class="absolute right-2 top-2 rounded-full bg-rose-600 p-2 text-white shadow-sm"
                                    title="ลบรูปนี้"
                                    on:click={(event) => {
                                        if (!confirm("ต้องการลบรูปนี้ใช่ไหม?")) {
                                            event.preventDefault();
                                        }
                                    }}
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}
        </section>

        <section class="surface-card p-5">
            <div class="mb-4">
                <h2 class="text-lg font-black text-slate-900 font-display">รายละเอียดรายการ</h2>
                <p class="text-sm text-slate-500">รูปแบบเดียวกับหน้าเพิ่มรายการ เพื่อให้แก้ได้ต่อเนื่องโดยไม่ต้องปรับตัว</p>
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
                    />
                </div>

                <div>
                    <label class="field-label" for="project_id">โปรเจค</label>
                    <select id="project_id" name="project_id" required class="field-input" value={data.expense.project_id}>
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
                            <div class="text-xs text-slate-500">ล็อกตามบัญชีผู้ใช้ปัจจุบัน</div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <div class="sticky-action-bar">
            <div class="mx-auto flex max-w-md gap-3">
                <a
                    href={`/expenses/${data.expense.id}`}
                    class="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-600"
                >
                    ยกเลิก
                </a>
                <button
                    type="submit"
                    disabled={loading}
                    class="flex flex-[1.3] items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                    {#if loading}
                        <Loader2 size={18} class="animate-spin" />
                        กำลังบันทึก...
                    {:else}
                        บันทึกการแก้ไข
                    {/if}
                </button>
            </div>
        </div>
    </form>
</div>
