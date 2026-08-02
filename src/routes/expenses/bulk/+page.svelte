<script lang="ts">
    import { applyAction, enhance } from "$app/forms";
    import { onDestroy, onMount } from "svelte";
    import {
        AlertTriangle,
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
    import EmptyState from "$lib/components/EmptyState.svelte";
    import { motion } from "$lib/motion";
    import Sheet from "$lib/components/Sheet.svelte";
    import { acquireOCRWorker, releaseOCRWorker } from "$lib/stores/ocrStore";
    import { toasts } from "$lib/stores/toast";
    import { extractFromImage, toFormFields } from "$lib/utils/slipClient";
    import { formatCurrency } from "$lib/utils/formatCurrency";
    import {
        aiCategorize,
        aiCategorizeBatch,
        expenseCategories,
        getTodayLocalDate,
        incomeCategories,
        inferCategoryFromText,
        isAiCategorizeAvailable,
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
    let cancelRequested = false;
    let scanTotal = 0;
    let scanDone = 0;
    let showApplyAll = false;
    let fileStore = new Map<number, File>();
    let nextFileIndex = 1;

    const defaultProject = data.projects.find((project) => project.name === "กองกลาง") || data.projects[0];
    const defaultProjectId = defaultProject?.id || "";

    let bulkProjectId = defaultProjectId;
    let bulkPaidBy = data.currentProfileId || "";
    let bulkDate = getTodayLocalDate();

    function getCategories(type: TransactionType) {
        return type === "income" ? incomeCategories : expenseCategories;
    }

    /** Every field the server rejects, checked here first so one bad slip
     *  cannot cost the user the whole batch. */
    function itemProblems(item: ReviewItem) {
        const problems: string[] = [];
        if (!item.amount || item.amount <= 0) problems.push("จำนวนเงิน");
        if (!item.description.trim()) problems.push("รายละเอียด");
        if (!item.projectId) problems.push("โปรเจค");
        if (!item.paidBy) problems.push("ผู้จ่าย");
        return problems;
    }

    async function autoCategory(item: ReviewItem): Promise<string> {
        const localMatch = inferCategoryFromText(item.transactionType, item.description, item.notes);
        if (localMatch) return localMatch;
        if (!isAiCategorizeAvailable()) return "";

        try {
            return (
                (await aiCategorize({
                    transactionType: item.transactionType,
                    description: item.description,
                    notes: item.notes,
                })) || ""
            );
        } catch {
            return "";
        }
    }

    function patchItem(fileIndex: number, patch: Partial<ReviewItem>) {
        items = items.map((item) => (item.fileIndex === fileIndex ? { ...item, ...patch } : item));
    }

    const CONCURRENCY = 3;
    const BACKOFF_MS = [1000, 4000, 10000];

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
            const hasText = Boolean(fields.notes || fields.description);
            // Keyword match is free and instant; anything it misses waits for the
            // one batched AI call fired once the whole scan finishes.
            const localMatch = hasText
                ? inferCategoryFromText("expense", fields.description, fields.notes)
                : "";
            const needsAi = hasText && !localMatch && isAiCategorizeAvailable();

            patchItem(fileIndex, {
                status: extraction.duplicate_of ? "duplicate" : "ready",
                duplicateExpenseId: extraction.duplicate_of?.expense_id ?? null,
                amount: fields.amount,
                date: fields.date || getTodayLocalDate(),
                notes: fields.notes,
                description: fields.description,
                category: localMatch,
                aiCategorizing: needsAi,
                ...(extraction.duplicate_of ? { expanded: true } : {}),
            });
        } catch (error) {
            console.error("Slip extraction error:", error);
            patchItem(fileIndex, { status: "error", expanded: true, aiCategorizing: false });
        }
    }

    /** Every slip still waiting on AI goes out in one request instead of one each. */
    async function categorizePending() {
        const pending = items.filter((item) => item.aiCategorizing);
        if (pending.length === 0) return;

        const suggestions = await aiCategorizeBatch(
            pending.map((item) => ({
                id: item.fileIndex,
                transactionType: item.transactionType,
                description: item.description,
                notes: item.notes,
            })),
        );

        items = items.map((item) =>
            item.aiCategorizing
                ? {
                      ...item,
                      category: item.category || suggestions.get(item.fileIndex) || "",
                      aiCategorizing: false,
                  }
                : item,
        );
    }

    async function processFiles(fileList: FileList) {
        const files = Array.from(fileList);
        isProcessing = true;
        cancelRequested = false;
        scanTotal = files.length;
        scanDone = 0;

        const queued: number[] = [];
        const startedEmpty = items.length === 0;

        files.forEach((file, index) => {
            const fileIndex = nextFileIndex++;
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
                    expanded: startedEmpty && index === 0,
                    aiCategorizing: false,
                },
            ];
        });

        // Simple promise pool: CONCURRENCY files in flight, one failure never aborts the batch.
        let cursor = 0;
        const runners = Array.from({ length: Math.min(CONCURRENCY, queued.length) }, async () => {
            while (cursor < queued.length && !cancelRequested) {
                await scanItem(queued[cursor++]);
                scanDone += 1;
            }
        });

        await Promise.all(runners);
        await categorizePending();

        isProcessing = false;
        if (cancelRequested) {
            // Files that never started stay in the queue so the user can retry or drop them.
            toasts.info(`หยุดการอ่านแล้ว · อ่านไปแล้ว ${scanDone}/${scanTotal} ใบ`);
        }
        cancelRequested = false;
    }

    function handleFileChange(event: Event) {
        const input = event.currentTarget as HTMLInputElement;
        if (input.files?.length) processFiles(input.files);
        input.value = "";
    }

    function removeItem(fileIndex: number) {
        const target = items.find((item) => item.fileIndex === fileIndex);
        if (target) URL.revokeObjectURL(target.previewUrl);
        fileStore.delete(fileIndex);
        items = items.filter((item) => item.fileIndex !== fileIndex);
    }

    function clearAll() {
        if (!confirm(`ล้างคิวทั้งหมด ${items.length} รายการ ใช่หรือไม่?`)) return;
        items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        items = [];
        fileStore = new Map();
    }

    function applyToAll() {
        items = items.map((item) => ({
            ...item,
            projectId: bulkProjectId || item.projectId,
            paidBy: bulkPaidBy || item.paidBy,
            date: bulkDate || item.date,
        }));
        showApplyAll = false;
        toasts.success("ใช้ค่ากับทุกใบแล้ว");
    }

    async function triggerItemAICategory(fileIndex: number) {
        const item = items.find((entry) => entry.fileIndex === fileIndex);
        if (!item || (!item.description && !item.notes) || item.category) return;

        patchItem(fileIndex, { aiCategorizing: true });
        const suggested = await autoCategory(item);
        patchItem(fileIndex, { category: suggested || item.category, aiCategorizing: false });
    }

    function expandInvalid() {
        items = items.map((item) => (itemProblems(item).length > 0 ? { ...item, expanded: true } : item));
    }

    $: invalidCount = items.filter((item) => itemProblems(item).length > 0).length;
    $: readyCount = items.length - invalidCount;
    $: totalAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0);
    $: scanProgress = scanTotal > 0 ? Math.round((scanDone / scanTotal) * 100) : 0;

    onMount(() => acquireOCRWorker());

    onDestroy(() => {
        cancelRequested = true;
        items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        releaseOCRWorker();
    });
</script>

<div class="page-shell page-shell-actions">
    <div class="flex items-center gap-2.5">
        <a href="/expenses" class="icon-button" aria-label="กลับไปหน้ารายการ">
            <ChevronLeft size={18} />
        </a>
        <h1 class="page-title">สแกนหลายสลิป</h1>
    </div>

    {#if form?.error}
        <div class="surface-card flex items-start gap-2 border-danger/30 bg-danger-soft p-3 text-sm font-medium text-danger-on-soft">
            <AlertTriangle size={16} class="mt-0.5 shrink-0" />
            {form.error}
        </div>
    {/if}

    <section class="surface-card p-4">
        <label
            class="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border-strong bg-surface-muted px-4 py-5 transition hover:border-accent hover:bg-accent-soft"
        >
            <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-surface text-accent">
                {#if isProcessing}
                    <ScanLine size={20} class="animate-pulse" />
                {:else}
                    <Upload size={20} />
                {/if}
            </div>
            <div>
                <div class="text-sm font-semibold text-soft">เลือกรูปหลายสลิป</div>
                <p class="text-xs text-muted">อัปโหลดแล้ว review ก่อนบันทึก</p>
            </div>
            <input type="file" multiple accept="image/*" class="sr-only" on:change={handleFileChange} />
        </label>

        {#if isProcessing}
            <div class="mt-3" in:fade={{ duration: motion.duration.base, easing: motion.easing.enter }}>
                <div class="mb-1.5 flex items-center justify-between text-xs font-medium">
                    <span class="text-accent">กำลังอ่าน {Math.min(scanDone + 1, scanTotal)}/{scanTotal}</span>
                    <button type="button" class="text-danger-on-soft" on:click={() => (cancelRequested = true)}>
                        หยุด
                    </button>
                </div>
                <div class="h-1.5 overflow-hidden rounded-full bg-surface-muted">
                    <div class="h-full bg-accent transition-all" style={`width: ${scanProgress}%`}></div>
                </div>
            </div>
        {/if}
    </section>

    {#if items.length === 0}
        <EmptyState
            icon={Upload}
            title="ยังไม่มีคิวรอตรวจ"
            description="อัปโหลดสลิปแล้วจะมาอยู่ในคิวด้านล่าง"
        />
    {:else}
        <section class="surface-card flex flex-wrap items-center gap-2 p-3">
            <span class="status-chip status-chip-cleared">พร้อม {readyCount}</span>
            {#if invalidCount > 0}
                <button type="button" class="status-chip status-chip-pending" on:click={expandInvalid}>
                    ต้องแก้ {invalidCount}
                </button>
            {/if}
            <span class="ml-auto text-sm font-bold text-text font-display">{formatCurrency(totalAmount)}</span>
            <button type="button" class="filter-chip" on:click={() => (showApplyAll = true)}>ตั้งค่าทุกใบ</button>
        </section>

        <form
            method="POST"
            action="?/batchSave"
            enctype="multipart/form-data"
            use:enhance={({ formData, cancel }) => {
                if (invalidCount > 0) {
                    cancel();
                    expandInvalid();
                    toasts.error(`มี ${invalidCount} รายการยังกรอกไม่ครบ`);
                    return;
                }

                loading = true;
                const savedCount = items.length;
                items.forEach((item, index) => {
                    const file = fileStore.get(item.fileIndex);
                    if (file) formData.append(`item_${index}_file`, file);
                });

                return async ({ result }) => {
                    loading = false;
                    if (result.type === "redirect") {
                        toasts.success(`บันทึก ${savedCount} รายการแล้ว`);
                        items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
                        items = [];
                        fileStore = new Map();
                    }
                    await applyAction(result);
                };
            }}
            class="space-y-3"
        >
            <input type="hidden" name="item_count" value={items.length} />

            {#each items as item, index (item.fileIndex)}
                {@const problems = itemProblems(item)}
                <section
                    class={`surface-card overflow-hidden ${problems.length > 0 ? "border-pending/50" : ""}`}
                    in:scale={{ duration: motion.duration.base, easing: motion.easing.enter }}
                >
                    <div class="flex gap-3 p-3">
                        <button
                            type="button"
                            class="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-muted"
                            aria-label={`ดูสลิปใบที่ ${index + 1}`}
                            on:click={() => (selectedPreview = item.previewUrl)}
                        >
                            <img src={item.previewUrl} alt="" class="h-full w-full object-cover" />
                            {#if item.status === "scanning"}
                                <div class="absolute inset-0 flex items-center justify-center bg-accent/40 text-white">
                                    <Loader2 size={18} class="animate-spin" />
                                </div>
                            {/if}
                        </button>

                        <div class="min-w-0 flex-1">
                            <div class="flex items-start justify-between gap-2">
                                <div class="min-w-0">
                                    <div class="flex items-center gap-2">
                                        <span class="text-sm font-semibold text-text">#{index + 1}</span>
                                        <span
                                            class={`status-chip ${
                                                item.status === "ready"
                                                    ? "status-chip-cleared"
                                                    : item.status === "error"
                                                      ? "bg-danger-soft text-danger-on-soft"
                                                      : item.status === "duplicate"
                                                        ? "status-chip-pending"
                                                        : item.status === "queued"
                                                          ? "bg-surface-muted text-muted"
                                                          : "bg-accent-soft text-accent-on-soft"
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
                                                class="text-xs font-semibold text-pending-on-soft underline"
                                            >
                                                ดูรายการเดิม
                                            </a>
                                        {/if}
                                    </div>
                                    <div class="mt-1 text-xl font-bold text-text font-display">
                                        {formatCurrency(item.amount || 0)}
                                    </div>
                                    <p class="mt-0.5 truncate text-xs text-muted">
                                        {item.description || "ยังไม่มีรายละเอียด"}
                                    </p>
                                </div>

                                <div class="flex shrink-0 items-center gap-1.5">
                                    <button
                                        type="button"
                                        class="rounded-lg border border-border bg-surface p-2.5 text-muted"
                                        aria-label="แสดง/ซ่อนรายละเอียด"
                                        aria-expanded={item.expanded}
                                        on:click={() => patchItem(item.fileIndex, { expanded: !item.expanded })}
                                    >
                                        <ChevronDown
                                            size={14}
                                            class={`transition-transform ${item.expanded ? "rotate-180" : ""}`}
                                        />
                                    </button>
                                    <button
                                        type="button"
                                        class="rounded-lg border border-danger/30 bg-danger-soft p-2.5 text-danger-on-soft"
                                        aria-label="ลบใบนี้ออกจากคิว"
                                        on:click={() => removeItem(item.fileIndex)}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            <div class="mt-2 flex flex-wrap gap-1.5 text-xs text-muted">
                                <span class="rounded-md bg-surface-muted px-2 py-0.5">{item.date}</span>
                                {#if item.aiCategorizing}
                                    <span class="inline-flex items-center gap-1 rounded-md bg-accent-soft px-2 py-0.5 text-accent-on-soft">
                                        <Sparkles size={10} class="animate-pulse" />
                                        AI วิเคราะห์...
                                    </span>
                                {:else}
                                    <span class="rounded-md bg-surface-muted px-2 py-0.5">
                                        {item.category || "ไม่มีหมวด"}
                                    </span>
                                {/if}
                                <span
                                    class={`rounded-md px-2 py-0.5 ${
                                        item.transactionType === "income"
                                            ? "bg-income-soft text-income-on-soft"
                                            : "bg-surface-muted"
                                    }`}
                                >
                                    {item.transactionType === "income" ? "รายรับ" : "รายจ่าย"}
                                </span>
                            </div>

                            {#if problems.length > 0}
                                <p class="mt-2 text-xs font-medium text-pending-on-soft">
                                    ยังขาด: {problems.join(", ")}
                                </p>
                            {/if}
                        </div>
                    </div>

                    <input type="hidden" name={`item_${index}_paid_by`} value={item.paidBy} />
                    <input type="hidden" name={`item_${index}_is_reimbursed`} value={item.isReimbursed ? "true" : "false"} />
                    <input type="hidden" name={`item_${index}_amount`} value={item.amount ?? ""} />
                    <input type="hidden" name={`item_${index}_date`} value={item.date} />
                    <input type="hidden" name={`item_${index}_description`} value={item.description} />
                    <input type="hidden" name={`item_${index}_category`} value={item.category} />
                    <input type="hidden" name={`item_${index}_project_id`} value={item.projectId} />
                    <input type="hidden" name={`item_${index}_transaction_type`} value={item.transactionType} />
                    <input type="hidden" name={`item_${index}_notes`} value={item.notes} />

                    {#if item.expanded}
                        <div
                            class="border-t border-border bg-surface-muted p-3"
                            in:fly={{ y: -8, duration: motion.duration.base, easing: motion.easing.enter }}
                        >
                            <div class="space-y-3">
                                <div class="grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-surface p-1.5">
                                    <button
                                        type="button"
                                        class={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                                            item.transactionType === "expense"
                                                ? "bg-surface-muted text-text ring-1 ring-border"
                                                : "text-muted"
                                        }`}
                                        on:click={() => patchItem(item.fileIndex, { transactionType: "expense" })}
                                    >
                                        <ArrowUpRight size={13} />
                                        รายจ่าย
                                    </button>
                                    <button
                                        type="button"
                                        class={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                                            item.transactionType === "income"
                                                ? "bg-income-soft text-income-on-soft ring-1 ring-income/30"
                                                : "text-muted"
                                        }`}
                                        on:click={() => patchItem(item.fileIndex, { transactionType: "income" })}
                                    >
                                        <ArrowDownLeft size={13} />
                                        รายรับ
                                    </button>
                                </div>

                                <div class="grid gap-3 md:grid-cols-2">
                                    <div>
                                        <label class="field-label" for={`amount-${item.fileIndex}`}>จำนวนเงิน</label>
                                        <input
                                            id={`amount-${item.fileIndex}`}
                                            type="number"
                                            inputmode="decimal"
                                            step="0.01"
                                            min="0"
                                            bind:value={item.amount}
                                            class="field-input no-spinner"
                                            placeholder="0.00"
                                        />
                                    </div>

                                    <div>
                                        <label class="field-label" for={`date-${item.fileIndex}`}>วันที่</label>
                                        <input
                                            id={`date-${item.fileIndex}`}
                                            type="date"
                                            bind:value={item.date}
                                            class="field-input"
                                        />
                                    </div>

                                    <div class="md:col-span-2">
                                        <label class="field-label" for={`description-${item.fileIndex}`}>รายละเอียด</label>
                                        <input
                                            id={`description-${item.fileIndex}`}
                                            type="text"
                                            bind:value={item.description}
                                            class="field-input"
                                            placeholder="อธิบายรายการนี้"
                                            on:change={() => triggerItemAICategory(item.fileIndex)}
                                        />
                                    </div>

                                    <div>
                                        <label class="field-label" for={`category-${item.fileIndex}`}>หมวดหมู่</label>
                                        <select id={`category-${item.fileIndex}`} bind:value={item.category} class="field-input">
                                            <option value="">เลือกหมวดหมู่</option>
                                            {#each getCategories(item.transactionType) as category (category)}
                                                <option value={category}>{category}</option>
                                            {/each}
                                        </select>
                                    </div>

                                    <div>
                                        <label class="field-label" for={`project-${item.fileIndex}`}>โปรเจค</label>
                                        <select id={`project-${item.fileIndex}`} bind:value={item.projectId} class="field-input">
                                            {#each data.projects as project (project.id)}
                                                <option value={project.id}>{project.name}</option>
                                            {/each}
                                        </select>
                                    </div>

                                    {#if data.profiles.length > 1}
                                        <div>
                                            <label class="field-label" for={`paid-by-${item.fileIndex}`}>ผู้จ่าย</label>
                                            <select id={`paid-by-${item.fileIndex}`} bind:value={item.paidBy} class="field-input">
                                                {#each data.profiles as profile (profile.id)}
                                                    <option value={profile.id}>
                                                        {profile.display_name}{profile.id === data.currentProfileId ? " (คุณ)" : ""}
                                                    </option>
                                                {/each}
                                            </select>
                                        </div>
                                    {/if}

                                    <div class="md:col-span-2">
                                        <label class="field-label" for={`notes-${item.fileIndex}`}>หมายเหตุ (ไม่บังคับ)</label>
                                        <textarea
                                            id={`notes-${item.fileIndex}`}
                                            bind:value={item.notes}
                                            class="field-input min-h-[70px]"
                                            placeholder="เช่น memo หรือ context เพิ่มเติม"
                                            on:change={() => triggerItemAICategory(item.fileIndex)}
                                        ></textarea>
                                    </div>

                                    {#if item.transactionType === "expense"}
                                        <div class="md:col-span-2">
                                            <button
                                                type="button"
                                                class={`flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left text-sm font-medium ${
                                                    item.isReimbursed
                                                        ? "bg-income-soft text-income-on-soft"
                                                        : "border border-border bg-surface text-soft"
                                                }`}
                                                aria-pressed={item.isReimbursed}
                                                on:click={() => patchItem(item.fileIndex, { isReimbursed: !item.isReimbursed })}
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
                    <button type="button" class="btn-secondary" on:click={clearAll}>ล้างทั้งหมด</button>
                    <button type="submit" disabled={loading || isProcessing || items.length === 0} class="btn-primary">
                        {#if loading}
                            <Loader2 size={16} class="animate-spin" />
                            กำลังบันทึก...
                        {:else if invalidCount > 0}
                            ยังกรอกไม่ครบ {invalidCount} รายการ
                        {:else}
                            บันทึก {items.length} รายการ
                        {/if}
                    </button>
                </div>
            </div>
        </form>
    {/if}
</div>

<Sheet open={showApplyAll} title="ใช้ค่านี้กับทุกใบ" on:close={() => (showApplyAll = false)}>
    <div class="space-y-3">
        <div>
            <label class="field-label" for="bulk-project">โปรเจค</label>
            <select id="bulk-project" class="field-input" data-autofocus bind:value={bulkProjectId}>
                {#each data.projects as project (project.id)}
                    <option value={project.id}>{project.name}</option>
                {/each}
            </select>
        </div>

        {#if data.profiles.length > 1}
            <div>
                <label class="field-label" for="bulk-paid-by">ผู้จ่าย</label>
                <select id="bulk-paid-by" class="field-input" bind:value={bulkPaidBy}>
                    {#each data.profiles as profile (profile.id)}
                        <option value={profile.id}>
                            {profile.display_name}{profile.id === data.currentProfileId ? " (คุณ)" : ""}
                        </option>
                    {/each}
                </select>
            </div>
        {/if}

        <div>
            <label class="field-label" for="bulk-date">วันที่</label>
            <input id="bulk-date" type="date" class="field-input" bind:value={bulkDate} />
        </div>

        <button type="button" class="btn-primary w-full" on:click={applyToAll}>
            ใช้กับ {items.length} รายการ
        </button>
    </div>
</Sheet>

{#if selectedPreview}
    <div
        class="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/90 p-4"
        transition:fade={{ duration: motion.duration.base, easing: motion.easing.standard }}
    >
        <img
            src={selectedPreview}
            alt="สลิปขนาดเต็ม"
            class="max-h-[85vh] max-w-full rounded-xl object-contain"
            in:scale={{ duration: motion.duration.slow, easing: motion.easing.enter }}
        />
        <button
            type="button"
            class="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur"
            aria-label="ปิดรูป"
            on:click={() => (selectedPreview = null)}
        >
            <X size={20} />
        </button>
    </div>
{/if}
