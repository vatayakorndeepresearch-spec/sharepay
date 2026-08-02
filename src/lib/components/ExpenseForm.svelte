<script lang="ts">
    import { enhance } from "$app/forms";
    import { onDestroy, onMount } from "svelte";
    import { slide } from "svelte/transition";
    import {
        AlertTriangle,
        ArrowDownLeft,
        ArrowUpRight,
        CheckCircle2,
        Image as ImageIcon,
        Loader2,
        Sparkles,
        Trash2,
    } from "lucide-svelte";
    import CategoryPicker from "$lib/components/CategoryPicker.svelte";
    import { acquireOCRWorker, releaseOCRWorker } from "$lib/stores/ocrStore";
    import { toasts } from "$lib/stores/toast";
    import { extractFromImage, toFormFields } from "$lib/utils/slipClient";
    import {
        aiCategorize,
        expenseCategories,
        getTodayLocalDate,
        incomeCategories,
        inferCategoryFromText,
        isAiCategorizeAvailable,
        quickParseExpense,
    } from "$lib/utils/expenseForm";
    import { rememberCategory } from "$lib/utils/recentCategories";

    type Project = { id: string; name: string };
    type Profile = { id: string; display_name: string };
    type Attachment = { id: string; file_url: string };

    export let mode: "new" | "edit" = "new";
    export let action: string;
    export let cancelHref: string;
    export let submitLabel: string;
    export let projects: Project[] = [];
    export let profiles: Profile[] = [];
    export let currentProfileId: string | null = null;
    export let currentUser: { name?: string | null } | null = null;
    export let attachments: Attachment[] = [];
    export let attachmentDeleteFormId = "";
    export let formError: string | null = null;
    export let initial: {
        transaction_type?: string;
        amount?: number | null;
        paid_at?: string;
        description?: string;
        notes?: string | null;
        category?: string | null;
        project_id?: string;
        paid_by?: string;
    } = {};

    const AMOUNT_SHORTCUTS = [20, 50, 100, 500];

    const defaultProjectId =
        initial.project_id ||
        projects.find((project) => project.name === "กองกลาง")?.id ||
        projects[0]?.id ||
        "";

    let transactionType: "expense" | "income" =
        initial.transaction_type === "income" ? "income" : "expense";
    let amount: number | null = initial.amount ?? null;
    let paidAt = initial.paid_at || getTodayLocalDate();
    let description = initial.description || "";
    let notes = initial.notes || "";
    let category = initial.category || "";
    let projectId = defaultProjectId;
    let paidBy = initial.paid_by || currentProfileId || "";
    let isReimbursed = false;

    let loading = false;
    let scanning = false;
    let aiCategorizing = false;
    let previewUrls: string[] = [];
    let slipNotice: string | null = null;
    let duplicateExpenseId: string | null = null;
    let slipExtractionJson = "";
    let highlightedFields: string[] = [];
    let highlightTimer: ReturnType<typeof setTimeout> | null = null;
    let aiDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    let dirty = false;

    $: availableCategories = transactionType === "income" ? incomeCategories : expenseCategories;
    $: hasProjects = projects.length > 0;
    $: canSubmit =
        hasProjects && !!projectId && !!paidBy && !!description.trim() && !!amount && amount > 0;

    function flashHighlights(fields: string[]) {
        highlightedFields = fields;
        if (highlightTimer) clearTimeout(highlightTimer);
        highlightTimer = setTimeout(() => (highlightedFields = []), 2200);
    }

    function isHighlighted(field: string) {
        return highlightedFields.includes(field);
    }

    function markDirty() {
        dirty = true;
    }

    function triggerAICategorize() {
        if (aiDebounceTimer) clearTimeout(aiDebounceTimer);
        aiDebounceTimer = null;

        // Never overwrite a category the user picked themselves.
        if (category) return;
        if (!notes && !description) return;

        const localMatch = inferCategoryFromText(transactionType, description, notes);
        if (localMatch) {
            category = localMatch;
            flashHighlights(["category"]);
            return;
        }

        if (!isAiCategorizeAvailable()) return;

        aiDebounceTimer = setTimeout(async () => {
            aiCategorizing = true;
            const snapshot = { description, notes, transactionType };
            try {
                const result = await aiCategorize(snapshot);
                if (result && !category) {
                    category = result;
                    flashHighlights(["category"]);
                }
            } finally {
                aiCategorizing = false;
            }
        }, 800);
    }

    function onTextInput() {
        markDirty();
        triggerAICategorize();
    }

    let quickText = "";
    let quickParsing = false;

    async function runQuickParse() {
        const text = quickText.trim();
        if (!text || quickParsing) return;

        quickParsing = true;
        try {
            const parsed = await quickParseExpense(text);
            if (!parsed) {
                toasts.error("แตกข้อความไม่สำเร็จ ลองพิมพ์ใหม่หรือกรอกเองได้เลย");
                return;
            }

            markDirty();
            transactionType = parsed.transaction_type;
            const filled: string[] = [];
            if (parsed.amount) {
                amount = parsed.amount;
                filled.push("amount");
            }
            if (parsed.description) {
                description = parsed.description;
                filled.push("description");
            }
            if (parsed.date) {
                paidAt = parsed.date;
                filled.push("date");
            }
            if (parsed.notes) {
                notes = parsed.notes;
                filled.push("notes");
            }
            if (parsed.category) {
                category = parsed.category;
                filled.push("category");
            }

            if (filled.length === 0) {
                toasts.error("ไม่พบข้อมูลในข้อความ ลองใส่จำนวนเงินด้วย");
                return;
            }

            flashHighlights(filled);
            quickText = "";
            toasts.success(`เติมให้แล้ว ${filled.length} ช่อง · ตรวจก่อนบันทึกได้`);
        } finally {
            quickParsing = false;
        }
    }

    function clearPreviews() {
        previewUrls.forEach((url) => URL.revokeObjectURL(url));
        previewUrls = [];
    }

    async function readSlip(file: File) {
        if (scanning) return;
        scanning = true;
        slipNotice = null;
        duplicateExpenseId = null;

        try {
            const extraction = await extractFromImage(file);
            slipExtractionJson = JSON.stringify(extraction);
            const fields = toFormFields(extraction);

            if (fields.amount) amount = fields.amount;
            if (fields.date) paidAt = fields.date;
            if (fields.notes) {
                notes = fields.notes;
                description = fields.description || description;
            }

            flashHighlights(fields.highlightedFields);

            if (extraction.duplicate_of) {
                duplicateExpenseId = extraction.duplicate_of.expense_id;
                slipNotice = "สลิปนี้เคยถูกบันทึกแล้ว";
            } else if (fields.highlightedFields.length === 0) {
                slipNotice = "อ่านสลิปไม่สำเร็จ กรอกเองได้เลย";
            } else {
                toasts.success(`เติมให้แล้ว ${fields.highlightedFields.length} ช่อง · ตรวจก่อนบันทึกได้`);
                if (!category) triggerAICategorize();
            }
        } catch (error) {
            console.error("Slip extraction error:", error);
            slipNotice = "อ่านสลิปไม่สำเร็จ กรอกเองได้เลย";
        } finally {
            scanning = false;
        }
    }

    function handleFileChange(event: Event) {
        const input = event.target as HTMLInputElement;
        clearPreviews();
        if (!input.files?.length) return;

        markDirty();
        const files = Array.from(input.files);
        previewUrls = files.map((file) => URL.createObjectURL(file));
        if (files[0]) readSlip(files[0]);
    }

    function bumpAmount(step: number) {
        amount = Number(((amount ?? 0) + step).toFixed(2));
        markDirty();
    }

    function beforeUnload(event: BeforeUnloadEvent) {
        if (!dirty || loading) return;
        event.preventDefault();
        event.returnValue = "";
    }

    onMount(() => acquireOCRWorker());

    onDestroy(() => {
        clearPreviews();
        if (highlightTimer) clearTimeout(highlightTimer);
        if (aiDebounceTimer) clearTimeout(aiDebounceTimer);
        releaseOCRWorker();
    });
</script>

<svelte:window on:beforeunload={beforeUnload} />

{#if formError}
    <div
        class="surface-card flex items-start gap-2 border-danger/30 bg-danger-soft p-3 text-sm font-medium text-danger-on-soft"
        in:slide
    >
        <AlertTriangle size={16} class="mt-0.5 shrink-0" />
        {formError}
    </div>
{/if}

{#if !hasProjects}
    <div class="surface-card border-pending/30 bg-pending-soft p-3 text-sm font-medium text-pending-on-soft">
        ยังไม่มีโปรเจคให้บันทึก สร้างโปรเจคก่อนอย่างน้อยหนึ่งอัน
    </div>
{/if}

<form
    method="POST"
    {action}
    enctype="multipart/form-data"
    use:enhance={() => {
        loading = true;
        return async ({ update, result }) => {
            loading = false;
            if (result.type === "redirect") {
                dirty = false;
                rememberCategory(transactionType, category);
            }
            await update();
        };
    }}
    class="space-y-4"
>
    {#if mode === "new"}
        <section class="surface-card p-4">
            <label class="field-label flex items-center gap-1.5" for="quick_text">
                <Sparkles size={13} class="text-accent" />
                พิมพ์เร็ว
            </label>
            <div class="flex gap-2">
                <input
                    id="quick_text"
                    type="text"
                    bind:value={quickText}
                    on:keydown={(event) => {
                        if (event.key === "Enter") {
                            event.preventDefault();
                            runQuickParse();
                        }
                    }}
                    class="field-input flex-1"
                    placeholder="เช่น ข้าวเที่ยง 450 หาร 3 คน เมื่อวาน"
                    disabled={quickParsing}
                />
                <button
                    type="button"
                    class="btn-secondary shrink-0 !w-auto px-4"
                    on:click={runQuickParse}
                    disabled={quickParsing || !quickText.trim()}
                >
                    {#if quickParsing}
                        <Loader2 size={16} class="animate-spin" />
                    {:else}
                        เติมให้
                    {/if}
                </button>
            </div>
            <p class="mt-1.5 text-xs text-muted">AI แตกเป็นจำนวนเงิน รายละเอียด วันที่ และหมวดหมู่ให้อัตโนมัติ</p>
        </section>
    {/if}

    <section class="surface-card p-1.5">
        <div class="grid grid-cols-2 gap-1.5 rounded-xl bg-surface-muted p-1">
            <label class="cursor-pointer">
                <input
                    type="radio"
                    class="sr-only"
                    name="transaction_type"
                    value="expense"
                    bind:group={transactionType}
                    on:change={markDirty}
                />
                <div
                    class={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                        transactionType === "expense"
                            ? "bg-surface text-text shadow-sm ring-1 ring-border"
                            : "text-muted"
                    }`}
                >
                    <ArrowUpRight size={16} />
                    รายจ่าย
                </div>
            </label>
            <label class="cursor-pointer">
                <input
                    type="radio"
                    class="sr-only"
                    name="transaction_type"
                    value="income"
                    bind:group={transactionType}
                    on:change={markDirty}
                />
                <div
                    class={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                        transactionType === "income"
                            ? "bg-surface text-income-on-soft shadow-sm ring-1 ring-income/30"
                            : "text-muted"
                    }`}
                >
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
                <span class="inline-flex items-center gap-1.5 text-xs font-medium text-accent">
                    <Sparkles size={12} class="animate-pulse" />
                    กำลังอ่านสลิป
                </span>
            {/if}
        </div>

        <div class="relative">
            <input
                id="amount"
                name="amount"
                type="number"
                inputmode="decimal"
                min="0"
                step="0.01"
                required
                bind:value={amount}
                on:input={markDirty}
                class={`field-input-hero pr-12 ${isHighlighted("amount") ? "field-highlight" : ""}`}
                placeholder="0.00"
            />
            <span class="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-medium text-muted">฿</span>
        </div>

        <div class="mt-2 flex flex-wrap gap-1.5">
            {#each AMOUNT_SHORTCUTS as step}
                <button type="button" class="filter-chip" on:click={() => bumpAmount(step)}>
                    +{step}
                </button>
            {/each}
            {#if amount}
                <button type="button" class="filter-chip" on:click={() => ((amount = null), markDirty())}>
                    ล้าง
                </button>
            {/if}
        </div>
    </section>

    <section class="surface-card p-4">
        <span class="field-label">หลักฐาน / สลิป</span>

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
            class="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border-strong bg-surface-muted px-4 py-5 transition hover:border-accent hover:bg-accent-soft"
        >
            <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-surface text-accent">
                {#if scanning}
                    <Loader2 size={20} class="animate-spin" />
                {:else}
                    <ImageIcon size={20} />
                {/if}
            </div>
            <div>
                <div class="text-sm font-semibold text-soft">
                    {mode === "edit" ? "เพิ่มรูปหลักฐานใหม่" : "อัปโหลดรูปสลิป"}
                </div>
                <p class="text-xs text-muted">
                    {mode === "edit" ? "รูปเดิมยังอยู่จนกว่าจะลบ" : "ระบบจะช่วยเติมข้อมูลจากรูป"}
                </p>
            </div>
        </label>

        {#if mode === "new"}
            <input type="hidden" name="slip_extraction" value={slipExtractionJson} />
        {/if}

        {#if slipNotice}
            <div
                class="mt-3 flex items-center justify-between gap-2 rounded-xl border border-pending/30 bg-pending-soft px-3 py-2 text-xs font-medium text-pending-on-soft"
                in:slide
            >
                <span>{slipNotice}</span>
                {#if duplicateExpenseId}
                    <a href={`/expenses/${duplicateExpenseId}`} class="shrink-0 font-semibold underline">
                        ดูรายการเดิม
                    </a>
                {/if}
            </div>
        {/if}

        {#if previewUrls.length > 0}
            <div class="mt-3 grid grid-cols-3 gap-2" in:slide>
                {#each previewUrls as url, index (url)}
                    <div class="overflow-hidden rounded-lg border border-border bg-surface-muted">
                        <img src={url} alt={`สลิปที่เพิ่งเลือก ${index + 1}`} class="h-20 w-full object-cover" />
                    </div>
                {/each}
            </div>
        {/if}

        {#if attachments.length > 0}
            <div class="mt-4">
                <div class="mb-2 text-xs font-medium text-muted">รูปที่มีอยู่แล้ว</div>
                <div class="grid grid-cols-3 gap-2">
                    {#each attachments as attachment (attachment.id)}
                        <div class="relative overflow-hidden rounded-lg border border-border bg-surface-muted">
                            <img src={attachment.file_url} alt="หลักฐานที่แนบไว้" class="h-20 w-full object-cover" />
                            <button
                                type="submit"
                                form={attachmentDeleteFormId}
                                name="attachment_id"
                                value={attachment.id}
                                class="absolute right-1.5 top-1.5 rounded-full bg-danger p-1.5 text-white"
                                aria-label="ลบรูปนี้"
                                on:click={(event) => {
                                    if (!confirm("ต้องการลบรูปนี้ใช่ไหม?")) event.preventDefault();
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

    <section class="surface-card space-y-3 p-4">
        <div>
            <label class="field-label" for="description">รายละเอียด</label>
            <input
                id="description"
                name="description"
                type="text"
                required
                bind:value={description}
                on:input={onTextInput}
                class={`field-input ${isHighlighted("description") ? "field-highlight" : ""}`}
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
                bind:value={projectId}
                on:change={markDirty}
            >
                {#each projects as project (project.id)}
                    <option value={project.id}>{project.name}</option>
                {/each}
            </select>
        </div>

        <div>
            <label class="field-label" for="paid_at">
                {transactionType === "expense" ? "วันที่จ่าย" : "วันที่รับเงิน"}
            </label>
            <input
                id="paid_at"
                name="paid_at"
                type="date"
                required
                bind:value={paidAt}
                on:input={markDirty}
                class={`field-input ${isHighlighted("date") ? "field-highlight" : ""}`}
            />
        </div>

        <CategoryPicker
            categories={availableCategories}
            {transactionType}
            bind:value={category}
            busy={aiCategorizing}
            highlighted={isHighlighted("category")}
        />

        <div>
            <label class="field-label" for="notes">หมายเหตุ (ไม่บังคับ)</label>
            <textarea
                id="notes"
                name="notes"
                bind:value={notes}
                on:input={onTextInput}
                class={`field-input min-h-[80px] ${isHighlighted("notes") ? "field-highlight" : ""}`}
                placeholder="เช่น memo หรือ context เพิ่มเติม — AI จะช่วยเลือกหมวดหมู่อัตโนมัติ"
            ></textarea>
        </div>

        <div>
            <label class="field-label" for="paid_by">
                {transactionType === "expense" ? "ผู้สำรองจ่าย" : "ผู้รับเงิน"}
            </label>
            {#if profiles.length > 1}
                <select id="paid_by" name="paid_by" required class="field-input" bind:value={paidBy} on:change={markDirty}>
                    {#each profiles as profile (profile.id)}
                        <option value={profile.id}>
                            {profile.display_name}{profile.id === currentProfileId ? " (คุณ)" : ""}
                        </option>
                    {/each}
                </select>
            {:else}
                <input type="hidden" name="paid_by" value={paidBy} />
                <div class="identity-chip">
                    <div class="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent-on-soft">
                        {(currentUser?.name || "?").trim().charAt(0).toUpperCase()}
                    </div>
                    <div class="min-w-0">
                        <div class="truncate text-sm font-medium text-text">
                            {currentUser?.name || "ไม่พบโปรไฟล์"}
                        </div>
                        <div class="text-xs text-muted">บัญชีปัจจุบัน</div>
                    </div>
                </div>
            {/if}
        </div>

        {#if mode === "new" && transactionType === "expense"}
            <label class="flex cursor-pointer items-start gap-3 rounded-xl border border-income/30 bg-income-soft px-3.5 py-3">
                <input
                    type="checkbox"
                    name="is_reimbursed"
                    class="mt-0.5 h-4 w-4 rounded border-income/40 text-income"
                    bind:checked={isReimbursed}
                    on:change={markDirty}
                />
                <div>
                    <div class="flex items-center gap-1.5 text-sm font-medium text-income-on-soft">
                        <CheckCircle2 size={14} />
                        เคลียร์แล้ว
                    </div>
                    <p class="text-xs text-income-on-soft/80">มีการโอนคืนครบแล้วก่อนบันทึก</p>
                </div>
            </label>
        {/if}
    </section>

    <div class="sticky-action-bar">
        <div class="mx-auto flex max-w-md gap-2">
            <a href={cancelHref} class="btn-secondary">ยกเลิก</a>
            <button type="submit" disabled={loading || scanning || !canSubmit} class="btn-primary">
                {#if loading}
                    <Loader2 size={16} class="animate-spin" />
                    กำลังบันทึก...
                {:else}
                    {submitLabel}
                {/if}
            </button>
        </div>
    </div>
</form>
