<script lang="ts">
    import { applyAction, enhance } from "$app/forms";
    import { formatCurrency } from "$lib/utils/formatCurrency";
    import { formatDate } from "$lib/utils/formatDate";
    import IdentityChip from "$lib/components/IdentityChip.svelte";
    import Sheet from "$lib/components/Sheet.svelte";
    import { toasts } from "$lib/stores/toast";
    import {
        CheckCircle2,
        ChevronLeft,
        Clock3,
        Loader2,
        MoreHorizontal,
        Pencil,
        Tag,
        Trash2,
        User,
        X,
    } from "lucide-svelte";
    import { fade, scale } from "svelte/transition";

    export let data;

    let showReimburseSheet = false;
    let showActionsSheet = false;
    let lightboxUrl: string | null = null;
    let loading = false;
    let reimburseProofPreviewUrl: string | null = null;

    $: expense = data.expense;
    $: isIncome = expense.transaction_type === "income";
    $: isPending = !expense.is_reimbursed && !isIncome;
    $: images = [
        ...(expense.attachments?.length
            ? expense.attachments.map((attachment: { file_url: string }) => ({
                  url: attachment.file_url,
                  label: "หลักฐาน",
              }))
            : expense.proof_image_url
              ? [{ url: expense.proof_image_url, label: "หลักฐาน" }]
              : []),
        ...(expense.reimbursement_proof_url
            ? [{ url: expense.reimbursement_proof_url, label: "หลักฐานโอนคืน" }]
            : []),
    ];

    function clearReimbursePreview() {
        if (reimburseProofPreviewUrl) URL.revokeObjectURL(reimburseProofPreviewUrl);
        reimburseProofPreviewUrl = null;
    }

    function handleReimburseFileChange(event: Event) {
        const input = event.target as HTMLInputElement;
        clearReimbursePreview();
        if (input.files?.[0]) {
            reimburseProofPreviewUrl = URL.createObjectURL(input.files[0]);
        }
    }
</script>

<div class={`page-shell ${isIncome && expense.is_reimbursed ? "" : "page-shell-actions"}`}>
    <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5">
            <a href="/expenses" class="icon-button" aria-label="กลับไปหน้ารายการ">
                <ChevronLeft size={18} />
            </a>
            <h1 class="page-title">รายละเอียด</h1>
        </div>

        <button
            type="button"
            class="icon-button"
            aria-label="ตัวเลือกเพิ่มเติม"
            aria-expanded={showActionsSheet}
            on:click={() => (showActionsSheet = true)}
        >
            <MoreHorizontal size={16} />
        </button>
    </div>

    <section class="surface-card relative overflow-hidden p-5 pl-6">
        <div
            class={`absolute inset-y-0 left-0 w-1.5 ${
                isPending ? "bg-pending" : isIncome ? "bg-income" : "bg-income"
            }`}
        ></div>

        <span
            class={`status-chip ${isPending ? "status-chip-pending" : "status-chip-cleared"}`}
        >
            {#if isPending}
                <Clock3 size={11} />
            {:else}
                <CheckCircle2 size={11} />
            {/if}
            {data.actionState.statusLabel}
        </span>

        <div class={`mt-3 text-3xl font-bold font-display ${isIncome ? "text-income-on-soft" : "text-text"}`}>
            {isIncome ? "+" : ""}{formatCurrency(expense.amount)}
        </div>
        <h2 class="mt-1 text-lg font-bold text-text font-display">{expense.description}</h2>
        <p class="mt-1 text-xs font-medium text-muted">
            {expense.projects?.name || "ไม่ระบุโปรเจค"}
        </p>
    </section>

    <section class="surface-card p-4">
        <h2 class="mb-3 text-sm font-semibold text-text">ข้อมูลหลัก</h2>

        <div class="grid gap-2">
            <div class="flex items-center gap-3 rounded-lg bg-surface-muted px-3 py-2.5">
                <Clock3 size={15} class="shrink-0 text-muted" />
                <div>
                    <div class="text-sm font-medium text-text">{formatDate(expense.paid_at)}</div>
                    <div class="text-xs text-muted">{isIncome ? "วันที่รับเงิน" : "วันที่จ่าย"}</div>
                </div>
            </div>

            <div class="flex items-center gap-3 rounded-lg bg-surface-muted px-3 py-2.5">
                <User size={15} class="shrink-0 text-muted" />
                <div>
                    <div class="text-sm font-medium text-text">
                        {expense.profiles?.display_name || "ไม่ระบุ"}
                    </div>
                    <div class="text-xs text-muted">{isIncome ? "ผู้รับเงิน" : "ผู้สำรองจ่าย"}</div>
                </div>
            </div>

            {#if expense.category}
                <div class="flex items-center gap-3 rounded-lg bg-surface-muted px-3 py-2.5">
                    <Tag size={15} class="shrink-0 text-muted" />
                    <div>
                        <div class="text-sm font-medium text-text">{expense.category}</div>
                        <div class="text-xs text-muted">หมวดหมู่</div>
                    </div>
                </div>
            {/if}

            {#if expense.notes}
                <div class="rounded-lg bg-surface-muted px-3 py-2.5">
                    <div class="text-xs text-muted">หมายเหตุ</div>
                    <div class="mt-0.5 whitespace-pre-line text-sm text-soft">{expense.notes}</div>
                </div>
            {/if}
        </div>
    </section>

    <section class="surface-card p-4">
        <h2 class="mb-3 text-sm font-semibold text-text">ไทม์ไลน์</h2>

        <div class="space-y-3">
            <div class="flex items-center gap-2.5">
                <div class="h-2 w-2 shrink-0 rounded-full bg-accent"></div>
                <div class="text-sm">
                    <span class="font-medium text-text">สร้างรายการ</span>
                    <span class="ml-2 text-xs text-muted">
                        {formatDate(expense.created_at || expense.paid_at)}
                    </span>
                </div>
            </div>

            {#if images.length > 0}
                <div class="flex items-center gap-2.5">
                    <div class="h-2 w-2 shrink-0 rounded-full bg-border-strong"></div>
                    <div class="text-sm">
                        <span class="font-medium text-text">แนบหลักฐาน</span>
                        <span class="ml-2 text-xs text-muted">{images.length} รูป</span>
                    </div>
                </div>
            {/if}

            {#if expense.is_reimbursed && expense.reimbursed_at}
                <div class="flex items-center gap-2.5">
                    <div class="h-2 w-2 shrink-0 rounded-full bg-income"></div>
                    <div class="text-sm">
                        <span class="font-medium text-text">เคลียร์แล้ว</span>
                        <span class="ml-2 text-xs text-muted">
                            {formatDate(expense.reimbursed_at)}
                            {#if expense.reimburser}
                                · {expense.reimburser.display_name}
                            {/if}
                        </span>
                    </div>
                </div>
            {/if}
        </div>
    </section>

    {#if images.length > 0}
        <section class="surface-card p-4">
            <h2 class="mb-3 text-sm font-semibold text-text">หลักฐาน</h2>
            <div class="grid grid-cols-2 gap-2">
                {#each images as image (image.url)}
                    <button
                        type="button"
                        class="overflow-hidden rounded-xl border border-border bg-surface-muted text-left"
                        on:click={() => (lightboxUrl = image.url)}
                    >
                        <img src={image.url} alt={image.label} class="h-32 w-full object-cover" />
                        <div class="px-3 py-2 text-xs font-medium text-soft">{image.label}</div>
                    </button>
                {/each}
            </div>
        </section>
    {/if}

    {#if data.actionState.canReimburse}
        <div class="sticky-action-bar">
            <div class="mx-auto max-w-md">
                <button type="button" class="btn-success" on:click={() => (showReimburseSheet = true)}>
                    <CheckCircle2 size={16} />
                    ทำเครื่องหมายว่าเคลียร์แล้ว
                </button>
            </div>
        </div>
    {:else if !isIncome}
        <div class="sticky-action-bar">
            <div class="mx-auto max-w-md">
                <form
                    action="?/unreimburse"
                    method="POST"
                    use:enhance={() => async ({ result, update }) => {
                        if (result.type === "success") toasts.info("ย้อนกลับเป็นยังไม่เคลียร์แล้ว");
                        await update();
                    }}
                >
                    <button type="submit" class="btn-secondary w-full">ย้อนกลับเป็นยังไม่เคลียร์</button>
                </form>
            </div>
        </div>
    {/if}
</div>

<Sheet open={showActionsSheet} title="จัดการรายการนี้" on:close={() => (showActionsSheet = false)}>
    <div class="grid gap-1">
        <a
            href={`/expenses/${expense.id}/edit`}
            class="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-soft transition-colors hover:bg-surface-muted"
            data-autofocus
        >
            <Pencil size={16} />
            แก้ไขรายการ
        </a>

        <form
            action="?/delete"
            method="POST"
            use:enhance={({ cancel }) => {
                if (!confirm("ลบรายการนี้ถาวร ยืนยันหรือไม่?")) {
                    cancel();
                    return;
                }
                return async ({ result }) => {
                    showActionsSheet = false;
                    if (result.type === "redirect") toasts.success("ลบรายการแล้ว");
                    await applyAction(result);
                };
            }}
        >
            <button
                type="submit"
                class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-danger-on-soft transition-colors hover:bg-danger-soft"
            >
                <Trash2 size={16} />
                ลบรายการ
            </button>
        </form>
    </div>
</Sheet>

<Sheet
    open={showReimburseSheet}
    title="ยืนยันการเคลียร์ยอด"
    on:close={() => {
        showReimburseSheet = false;
        clearReimbursePreview();
    }}
>
    <form
        action="?/reimburse"
        method="POST"
        enctype="multipart/form-data"
        use:enhance={() => {
            loading = true;
            return async ({ result, update }) => {
                loading = false;
                showReimburseSheet = false;
                clearReimbursePreview();
                if (result.type === "success") toasts.success("เคลียร์ยอดเรียบร้อย");
                await update();
            };
        }}
        class="space-y-3"
    >
        <input type="hidden" name="reimbursed_by" value={data.currentProfileId || ""} />

        <div>
            <span class="field-label">ผู้ยืนยัน</span>
            <IdentityChip name={data.currentUser?.name} avatarUrl={data.currentUser?.avatar_url} />
        </div>

        <div>
            <label class="field-label" for="proof_image">หลักฐานโอนคืน (ไม่บังคับ)</label>
            <input
                type="file"
                id="proof_image"
                name="proof_image"
                accept="image/png, image/jpeg, image/webp, image/heic"
                class="field-input"
                on:change={handleReimburseFileChange}
            />
        </div>

        {#if reimburseProofPreviewUrl}
            <div class="overflow-hidden rounded-xl border border-border bg-surface-muted">
                <img src={reimburseProofPreviewUrl} alt="ตัวอย่างหลักฐานโอนคืน" class="max-h-48 w-full object-cover" />
            </div>
        {/if}

        <button type="submit" disabled={loading} class="btn-success">
            {#if loading}
                <Loader2 size={16} class="animate-spin" />
                กำลังบันทึก...
            {:else}
                ยืนยัน
            {/if}
        </button>
    </form>
</Sheet>

{#if lightboxUrl}
    <div class="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/90 p-4" transition:fade={{ duration: 150 }}>
        <img src={lightboxUrl} alt="หลักฐานขนาดเต็ม" class="max-h-[85vh] max-w-full rounded-xl object-contain" in:scale />
        <button
            type="button"
            class="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur"
            aria-label="ปิดรูป"
            on:click={() => (lightboxUrl = null)}
        >
            <X size={20} />
        </button>
        <a
            href={lightboxUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="absolute bottom-6 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white backdrop-blur"
        >
            เปิดรูปต้นฉบับ
        </a>
    </div>
{/if}
