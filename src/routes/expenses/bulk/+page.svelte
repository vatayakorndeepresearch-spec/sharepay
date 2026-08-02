<script lang="ts">
    import { enhance } from "$app/forms";
    import { onDestroy } from "svelte";
    import {
        ArrowDownLeft,
        ArrowUpRight,
        CheckCircle2,
        ChevronDown,
        ChevronLeft,
        Loader2,
        ScanLine,
        Sparkles,
        Trash2,
        Upload,
        X,
    } from "lucide-svelte";
    import { fade, fly, scale } from "svelte/transition";
    import { terminateOCRWorker } from "$lib/stores/ocrStore";
    import { extractFromImage, toFormFields } from "$lib/utils/slipClient";
    import {
        expenseCategories,
        incomeCategories,
        inferCategoryFromText,
        aiCategorize,
        getTodayLocalDate,
    } from "$lib/utils/expenseForm";

    export let data;
    export let form;

    type TransactionType = "expense" | "income";

    type ReviewItem = {
        fileIndex: number;
        previewUrl: string;
        status: "queued" | "scanning" | "ready" | "error" | "duplicate";
        duplicateExpenseId: string | null;
        amount: number | null;
        notes: string;
        description: string;
        date: string;
        category: string;
        projectId: string;
        paidBy: string;
        transactionType: TransactionType;
        isReimbursed: boolean;
        expanded: boolean;
        aiCategorizing: boolean;
    };

    let loading = false;
    let selectedPreview: string | null = null;
    let items: ReviewItem[] = [];
    let isProcessing = false;
    let fileStore: Map<number, File> = new Map();

    const defaultProject = data.projects.find((project) => project.name === "กองกลาง") || data.projects[0];
    const defaultProjectId = defaultProject?.id || "";

    function getCategories(type: TransactionType) {
        return type === "income" ? [...incomeCategories] : [...expenseCategories];
    }

    async function autoCategory(item: ReviewItem): Promise<string> {
        // Try keyword matching first
        const localMatch = inferCategoryFromText(item.transactionType, item.description, item.notes);
        if (localMatch) return localMatch;

        // Fall back to AI
        try {
            const result = await aiCategorize({
                transactionType: item.transactionType,
                description: item.description,
                notes: item.notes,
            });
            return result || "";
        } catch {
            return "";
        }
    }

    const CONCURRENCY = 3;
    const BACKOFF_MS = [1000, 4000, 10000];

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    function patchItem(fileIndex: number, patch: Partial<ReviewItem>) {
        items = items.map((item) => (item.fileIndex === fileIndex ? { ...item, ...patch } : item));
    }

    /** Retries only on provider rate limits; any other failure lands on the Tesseract path. */
    async function extractWithRetry(file: File) {
        for (let attempt = 0; ; attempt++) {
            try {
                return await extractFromImage(file);
            } catch (error: any) {
                if (error?.status === 429 && attempt < BACKOFF_MS.length) {
                    await sleep(BACKOFF_MS[attempt]);
                    continue;
                }
                return await extractFromImage(file, { forceFallback: true });
            }
        }
    }

    async function scanItem(fileIndex: number) {
        const file = fileStore.get(fileIndex);
        if (!file) return;

        patchItem(fileIndex, { status: "scanning" });

        try {
            const extraction = await extractWithRetry(file);
            const fields = toFormFields(extraction);
            const hasText = !!(fields.notes || fields.description);

            patchItem(fileIndex, {
                status: extraction.duplicate_of ? "duplicate" : "ready",
                duplicateExpenseId: extraction.duplicate_of?.expense_id ?? null,
                amount: fields.amount,
                date: fields.date || getTodayLocalDate(),
                notes: fields.notes,
                description: fields.description,
                category: "",
                aiCategorizing: hasText,
                ...(extraction.duplicate_of ? { expanded: true } : {}),
            });

            if (hasText) {
                const updatedItem = items.find((item) => item.fileIndex === fileIndex);
                if (updatedItem) {
                    const suggestedCategory = await autoCategory(updatedItem);
                    patchItem(fileIndex, { category: suggestedCategory, aiCategorizing: false });
                }
            }
        } catch (error) {
            console.error("Slip extraction error:", error);
            patchItem(fileIndex, { status: "error", expanded: true, aiCategorizing: false });
        }
    }

    async function processFiles(files: FileList) {
        isProcessing = true;

        const queued: number[] = [];
        const startedEmpty = items.length === 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileIndex = Date.now() + i;
            fileStore.set(fileIndex, file);
            queued.push(fileIndex);

            items = [
                ...items,
                {
                    fileIndex,
                    previewUrl: URL.createObjectURL(file),
                    status: "queued",
                    duplicateExpenseId: null,
                    amount: null,
                    notes: "",
                    description: "",
                    date: getTodayLocalDate(),
                    category: "",
                    projectId: defaultProjectId,
                    paidBy: data.currentProfileId || "",
                    transactionType: "expense",
                    isReimbursed: false,
                    expanded: startedEmpty && i === 0,
                    aiCategorizing: false,
                },
            ];
        }

        // Simple promise pool: CONCURRENCY files in flight, one failure never aborts the batch.
        let cursor = 0;
        const runners = Array.from({ length: Math.min(CONCURRENCY, queued.length) }, async () => {
            while (cursor < queued.length) {
                const fileIndex = queued[cursor++];
                await scanItem(fileIndex);
            }
        });

        await Promise.all(runners);
        isProcessing = false;
    }

    function handleFileChange(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files?.length) {
            processFiles(input.files);
        }
    }

    function removeItem(fileIndex: number) {
        fileStore.delete(fileIndex);
        items = items.filter((item) => item.fileIndex !== fileIndex);
    }

    function toggleExpanded(fileIndex: number) {
        items = items.map((item) =>
            item.fileIndex === fileIndex ? { ...item, expanded: !item.expanded } : item
        );
    }

    function updateItemField(fileIndex: number, field: keyof ReviewItem, value: unknown) {
        items = items.map((item) =>
            item.fileIndex === fileIndex ? { ...item, [field]: value } : item
        );
    }

    async function triggerItemAICategory(fileIndex: number) {
        const item = items.find((i) => i.fileIndex === fileIndex);
        if (!item || !item.description && !item.notes) return;

        updateItemField(fileIndex, "aiCategorizing", true);
        const suggested = await autoCategory(item);
        items = items.map((i) =>
            i.fileIndex === fileIndex
                ? { ...i, category: suggested || i.category, aiCategorizing: false }
                : i
        );
    }

    $: reviewableItems = items;

    onDestroy(() => {
        terminateOCRWorker();
    });
</script>

<div class="page-shell pb-36">
    <div class="flex items-center gap-2.5 px-1">
        <a
            href="/expenses"
            class="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500"
        >
            <ChevronLeft size={18} />
        </a>
        <h1 class="text-xl font-bold text-slate-900 font-display">สแกนหลายสลิป</h1>
    </div>

    {#if form?.error}
        <div class="surface-card border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
            {form.error}
        </div>
    {/if}

    <section class="surface-card p-4">
        <label
            class="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 transition hover:border-indigo-300 hover:bg-indigo-50"
        >
            <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-indigo-600">
                {#if isProcessing}
                    <ScanLine size={20} class="animate-spin" />
                {:else}
                    <Upload size={20} />
                {/if}
            </div>
            <div>
                <div class="text-sm font-semibold text-slate-700">เลือกรูปหลายสลิป</div>
                <p class="text-xs text-slate-500">อัปโหลดแล้ว review ก่อนบันทึก</p>
            </div>
            <input type="file" multiple accept="image/*" class="hidden" on:change={handleFileChange} />
        </label>
    </section>

    {#if reviewableItems.length === 0}
        <section class="surface-card p-6 text-center">
            <div class="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                <Upload size={22} />
            </div>
            <h2 class="text-base font-bold text-slate-900">ยังไม่มีคิวรอตรวจ</h2>
            <p class="mt-1 text-sm text-slate-500">อัปโหลดสลิปแล้วจะมาอยู่ในคิวด้านล่าง</p>
        </section>
    {:else}
        <form
            method="POST"
            action="?/batchSave"
            enctype="multipart/form-data"
            use:enhance={({ formData }) => {
                loading = true;
                reviewableItems.forEach((item, index) => {
                    const file = fileStore.get(item.fileIndex);
                    if (file) {
                        formData.append(`item_${index}_file`, file);
                    }
                });

                return async ({ result, update }) => {
                    loading = false;
                    if (result.type === "redirect") {
                        window.location.href = result.location;
                    } else {
                        await update();
                    }
                };
            }}
            class="space-y-3"
        >
            <input type="hidden" name="item_count" value={reviewableItems.length} />

            {#each reviewableItems as item, index}
                <section class="surface-card overflow-hidden" in:scale>
                    <div class="flex gap-3 p-3">
                        <button
                            type="button"
                            class="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                            on:click={() => (selectedPreview = item.previewUrl)}
                        >
                            <img src={item.previewUrl} alt="Slip preview" class="h-full w-full object-cover" />
                            {#if item.status === "scanning"}
                                <div class="absolute inset-0 flex items-center justify-center bg-indigo-600/40 text-white">
                                    <Loader2 size={18} class="animate-spin" />
                                </div>
                            {/if}
                        </button>

                        <div class="min-w-0 flex-1">
                            <div class="flex items-start justify-between gap-2">
                                <div>
                                    <div class="flex items-center gap-2">
                                        <span class="text-sm font-semibold text-slate-900">#{index + 1}</span>
                                        <span
                                            class={`status-chip ${
                                                item.status === "ready"
                                                    ? "bg-emerald-50 text-emerald-700"
                                                    : item.status === "error"
                                                      ? "bg-rose-50 text-rose-700"
                                                      : item.status === "duplicate"
                                                        ? "bg-amber-50 text-amber-700"
                                                        : item.status === "queued"
                                                          ? "bg-slate-100 text-slate-500"
                                                          : "bg-indigo-50 text-indigo-700"
                                            }`}
                                        >
                                            {item.status === "ready"
                                                ? "พร้อม"
                                                : item.status === "error"
                                                  ? "อ่านไม่ได้"
                                                  : item.status === "duplicate"
                                                    ? "สลิปซ้ำ"
                                                    : item.status === "queued"
                                                      ? "รอคิว"
                                                      : "กำลังอ่าน"}
                                        </span>
                                        {#if item.status === "duplicate" && item.duplicateExpenseId}
                                            <a
                                                href={`/expenses/${item.duplicateExpenseId}`}
                                                class="text-xs font-semibold text-amber-700 underline"
                                            >
                                                ดูรายการเดิม
                                            </a>
                                        {/if}
                                    </div>
                                    <div class="mt-1 text-xl font-bold text-slate-900 font-display">
                                        {item.amount ? item.amount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                                    </div>
                                    <p class="mt-0.5 truncate text-xs text-slate-500">
                                        {item.description || "ยังไม่มีรายละเอียด"}
                                    </p>
                                </div>

                                <div class="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        class="rounded-lg border border-slate-200 bg-white p-2 text-slate-400"
                                        aria-label="Toggle item details"
                                        on:click={() => toggleExpanded(item.fileIndex)}
                                    >
                                        <ChevronDown
                                            size={14}
                                            class={`transition-transform ${item.expanded ? "rotate-180" : ""}`}
                                        />
                                    </button>
                                    <button
                                        type="button"
                                        class="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-500"
                                        aria-label="Remove item"
                                        on:click={() => removeItem(item.fileIndex)}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            <div class="mt-2 flex flex-wrap gap-1.5 text-xs text-slate-500">
                                <span class="rounded-md bg-slate-100 px-2 py-0.5">{item.date}</span>
                                {#if item.aiCategorizing}
                                    <span class="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-indigo-600">
                                        <Sparkles size={10} class="animate-pulse" />
                                        AI วิเคราะห์...
                                    </span>
                                {:else}
                                    <span class="rounded-md bg-slate-100 px-2 py-0.5">{item.category || "ไม่มีหมวด"}</span>
                                {/if}
                                <span class={`rounded-md px-2 py-0.5 ${item.transactionType === "income" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100"}`}>
                                    {item.transactionType === "income" ? "รายรับ" : "รายจ่าย"}
                                </span>
                            </div>
                        </div>
                    </div>

                    <input type="hidden" name={`item_${index}_paid_by`} value={item.paidBy || ""} />
                    <input type="hidden" name={`item_${index}_is_reimbursed`} value={item.isReimbursed ? "true" : "false"} />
                    <input type="hidden" name={`item_${index}_amount`} value={item.amount || ""} />
                    <input type="hidden" name={`item_${index}_date`} value={item.date} />
                    <input type="hidden" name={`item_${index}_description`} value={item.description} />
                    <input type="hidden" name={`item_${index}_category`} value={item.category} />
                    <input type="hidden" name={`item_${index}_project_id`} value={item.projectId} />
                    <input type="hidden" name={`item_${index}_transaction_type`} value={item.transactionType} />
                    <input type="hidden" name={`item_${index}_notes`} value={item.notes} />

                    {#if item.expanded}
                        <div class="border-t border-slate-100 bg-slate-50 p-3" in:fly={{ y: -8, duration: 150 }}>
                            <div class="space-y-3">
                                <!-- Transaction type toggle -->
                                <div class="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5">
                                    <button
                                        type="button"
                                        class={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                                            item.transactionType === "expense" ? "bg-slate-900 text-white" : "text-slate-400"
                                        }`}
                                        on:click={() => updateItemField(item.fileIndex, "transactionType", "expense")}
                                    >
                                        <ArrowUpRight size={13} />
                                        รายจ่าย
                                    </button>
                                    <button
                                        type="button"
                                        class={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                                            item.transactionType === "income" ? "bg-emerald-600 text-white" : "text-slate-400"
                                        }`}
                                        on:click={() => updateItemField(item.fileIndex, "transactionType", "income")}
                                    >
                                        <ArrowDownLeft size={13} />
                                        รายรับ
                                    </button>
                                </div>

                                <div class="grid gap-3 md:grid-cols-2">
                                    <div>
                                        <div class="field-label">จำนวนเงิน</div>
                                        <input
                                            type="number"
                                            step="0.01"
                                            bind:value={item.amount}
                                            class="field-input"
                                            placeholder="0.00"
                                            on:change={() => updateItemField(item.fileIndex, "amount", item.amount)}
                                        />
                                    </div>

                                    <div>
                                        <div class="field-label">วันที่</div>
                                        <input
                                            type="date"
                                            bind:value={item.date}
                                            class="field-input"
                                            on:change={() => updateItemField(item.fileIndex, "date", item.date)}
                                        />
                                    </div>

                                    <div class="md:col-span-2">
                                        <div class="field-label">รายละเอียด</div>
                                        <input
                                            type="text"
                                            bind:value={item.description}
                                            class="field-input"
                                            placeholder="อธิบายรายการนี้"
                                            on:input={() => {
                                                updateItemField(item.fileIndex, "description", item.description);
                                                triggerItemAICategory(item.fileIndex);
                                            }}
                                        />
                                    </div>

                                    <div>
                                        <div class="flex items-center justify-between">
                                            <div class="field-label mb-0">หมวดหมู่</div>
                                            {#if item.aiCategorizing}
                                                <div class="inline-flex items-center gap-1 text-xs font-medium text-indigo-600" in:fade>
                                                    <Sparkles size={10} class="animate-pulse" />
                                                    AI วิเคราะห์...
                                                </div>
                                            {/if}
                                        </div>
                                        <select
                                            bind:value={item.category}
                                            class="field-input mt-1"
                                            on:change={() => updateItemField(item.fileIndex, "category", item.category)}
                                        >
                                            <option value="">เลือกหมวดหมู่</option>
                                            {#each getCategories(item.transactionType) as cat}
                                                <option value={cat}>{cat}</option>
                                            {/each}
                                        </select>
                                    </div>

                                    <div>
                                        <div class="field-label">โปรเจค</div>
                                        <select
                                            bind:value={item.projectId}
                                            class="field-input"
                                            on:change={() => updateItemField(item.fileIndex, "projectId", item.projectId)}
                                        >
                                            {#each data.projects as project}
                                                <option value={project.id}>{project.name}</option>
                                            {/each}
                                        </select>
                                    </div>

                                    <div class="md:col-span-2">
                                        <div class="field-label">หมายเหตุ (ไม่บังคับ)</div>
                                        <textarea
                                            bind:value={item.notes}
                                            class="field-input min-h-[70px]"
                                            placeholder="เช่น memo หรือ context เพิ่มเติม — AI จะช่วยเลือกหมวดหมู่อัตโนมัติ"
                                            on:input={() => {
                                                updateItemField(item.fileIndex, "notes", item.notes);
                                                triggerItemAICategory(item.fileIndex);
                                            }}
                                        ></textarea>
                                    </div>

                                    {#if item.transactionType === "expense"}
                                        <div class="md:col-span-2">
                                            <button
                                                type="button"
                                                class={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium ${
                                                    item.isReimbursed
                                                        ? "bg-emerald-50 text-emerald-700"
                                                        : "bg-white border border-slate-200 text-slate-600"
                                                }`}
                                                on:click={() => {
                                                    items = items.map((entry) =>
                                                        entry.fileIndex === item.fileIndex
                                                            ? { ...entry, isReimbursed: !entry.isReimbursed }
                                                            : entry
                                                    );
                                                }}
                                            >
                                                <CheckCircle2 size={16} />
                                                {item.isReimbursed ? "เคลียร์แล้ว" : "ยังไม่เคลียร์"}
                                            </button>
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        </div>
                    {/if}
                </section>
            {/each}

            <div class="sticky-action-bar">
                <div class="mx-auto flex max-w-md gap-2">
                    <button
                        type="button"
                        class="btn-secondary"
                        on:click={() => {
                            items = [];
                            fileStore = new Map();
                        }}
                    >
                        ล้างทั้งหมด
                    </button>
                    <button
                        type="submit"
                        disabled={loading || isProcessing || !reviewableItems.length}
                        class="btn-primary"
                    >
                        {#if loading}
                            <Loader2 size={16} class="animate-spin" />
                            กำลังบันทึก...
                        {:else}
                            บันทึก {reviewableItems.length} รายการ
                        {/if}
                    </button>
                </div>
            </div>
        </form>
    {/if}
</div>

{#if selectedPreview}
    <button
        type="button"
        class="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4"
        aria-label="Close preview"
        on:click={() => (selectedPreview = null)}
        in:fade={{ duration: 150 }}
        out:fade={{ duration: 100 }}
    >
        <img
            src={selectedPreview}
            alt="Slip preview"
            class="max-h-[90vh] max-w-full rounded-xl object-contain"
            in:scale
        />
        <span class="sr-only">Close preview</span>
    </button>
{/if}
