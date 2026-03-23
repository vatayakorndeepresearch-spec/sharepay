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

<div class="page-shell pb-36">
    <div class="flex items-center gap-2.5 px-1">
        <a
            href={`/expenses/${data.expense.id}`}
            class="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500"
        >
            <ChevronLeft size={18} />
        </a>
        <h1 class="text-xl font-bold text-slate-900 font-display">แก้ไขรายการ</h1>
    </div>

    {#if form?.error}
        <div class="surface-card border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
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
        class="space-y-4"
    >
        <section class="surface-card p-1.5">
            <div class="grid grid-cols-2 gap-1.5">
                <label class="cursor-pointer">
                    <input type="radio" class="sr-only" name="transaction_type" value="expense" bind:group={transactionType} />
                    <div class={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                        transactionType === "expense" ? "bg-slate-900 text-white" : "bg-white text-slate-400"
                    }`}>
                        <ArrowUpRight size={16} />
                        รายจ่าย
                    </div>
                </label>
                <label class="cursor-pointer">
                    <input type="radio" class="sr-only" name="transaction_type" value="income" bind:group={transactionType} />
                    <div class={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                        transactionType === "income" ? "bg-emerald-600 text-white" : "bg-white text-slate-400"
                    }`}>
                        <ArrowDownLeft size={16} />
                        รายรับ
                    </div>
                </label>
            </div>
        </section>

        <section class="surface-card p-4">
            <div class="mb-2 flex items-center justify-between">
                <label class="field-label mb-0" for="amount">จำนวนเงิน (บาท)</label>
                {#if scanning}
                    <span class="text-xs font-medium text-indigo-600">กำลังอ่านสลิป</span>
                {/if}
            </div>
            <div class="relative">
                <input
                    id="amount"
                    name="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    bind:value={amount}
                    class={`field-input-hero pr-12 ${isHighlighted("amount") ? "border-indigo-300 bg-indigo-50 text-indigo-700" : ""}`}
                />
                <span class="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-medium text-slate-300">฿</span>
            </div>
        </section>

        <section class="surface-card p-4">
            <label class="field-label" for="proof_images">หลักฐาน / สลิป</label>

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
                class="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 transition hover:border-indigo-300 hover:bg-indigo-50"
            >
                <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-indigo-600">
                    <ImageIcon size={20} />
                </div>
                <div>
                    <div class="text-sm font-semibold text-slate-700">เพิ่มรูปหลักฐานใหม่</div>
                    <p class="text-xs text-slate-500">รูปเดิมยังอยู่จนกว่าจะลบ</p>
                </div>
            </label>

            {#if previewUrls.length > 0}
                <div class="mt-3 grid grid-cols-3 gap-2">
                    {#each previewUrls as url, index}
                        <div class="overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                            <img src={url} alt={`New proof ${index + 1}`} class="h-20 w-full object-cover" />
                        </div>
                    {/each}
                </div>
            {/if}

            {#if data.expense.attachments?.length}
                <div class="mt-4">
                    <div class="mb-2 text-xs font-medium text-slate-500">รูปที่มีอยู่แล้ว</div>
                    <div class="grid grid-cols-3 gap-2">
                        {#each data.expense.attachments as attachment}
                            <div class="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                                <img src={attachment.file_url} alt="Attachment" class="h-20 w-full object-cover" />
                                <button
                                    type="submit"
                                    formaction="?/deleteAttachment"
                                    name="attachment_id"
                                    value={attachment.id}
                                    class="absolute right-1.5 top-1.5 rounded-full bg-rose-600 p-1.5 text-white"
                                    title="ลบรูปนี้"
                                    on:click={(event) => {
                                        if (!confirm("ต้องการลบรูปนี้ใช่ไหม?")) {
                                            event.preventDefault();
                                        }
                                    }}
                                >
                                    <Trash2 size={11} />
                                </button>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}
        </section>

        <section class="surface-card p-4">
            <div class="space-y-3">
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
                            class="field-input mt-2"
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
                        class={`field-input min-h-[80px] ${isHighlighted("notes") ? "border-indigo-300 bg-indigo-50" : ""}`}
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
                                class="h-7 w-7 rounded-full object-cover"
                                referrerpolicy="no-referrer"
                            />
                        {/if}
                        <div>
                            <div class="text-sm font-medium text-slate-800">{data.currentUser?.name || "ไม่พบโปรไฟล์"}</div>
                            <div class="text-xs text-slate-500">บัญชีปัจจุบัน</div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <div class="sticky-action-bar">
            <div class="mx-auto flex max-w-md gap-2">
                <a
                    href={`/expenses/${data.expense.id}`}
                    class="btn-secondary"
                >
                    ยกเลิก
                </a>
                <button
                    type="submit"
                    disabled={loading}
                    class="btn-primary"
                >
                    {#if loading}
                        <Loader2 size={16} class="animate-spin" />
                        กำลังบันทึก...
                    {:else}
                        บันทึกการแก้ไข
                    {/if}
                </button>
            </div>
        </div>
    </form>
</div>
