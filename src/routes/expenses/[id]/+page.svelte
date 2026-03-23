<script lang="ts">
    import { enhance } from "$app/forms";
    import { formatCurrency } from "$lib/utils/formatCurrency";
    import { formatDate } from "$lib/utils/formatDate";
    import {
        CheckCircle2,
        ChevronLeft,
        Clock3,
        ExternalLink,
        Loader2,
        MoreHorizontal,
        Pencil,
        Trash2,
        User,
        Wallet,
        X,
    } from "lucide-svelte";
    import { fade, fly, scale } from "svelte/transition";

    export let data;

    let showReimburseSheet = false;
    let showActions = false;
    let loading = false;
    let reimburseProofPreviewUrl: string | null = null;

    function handleReimburseFileChange(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files?.[0]) {
            const reader = new FileReader();
            reader.onload = (loadEvent) => {
                reimburseProofPreviewUrl = loadEvent.target?.result as string;
            };
            reader.readAsDataURL(input.files[0]);
        } else {
            reimburseProofPreviewUrl = null;
        }
    }
</script>

<div class="page-shell pb-36">
    <div class="flex items-center justify-between px-1">
        <div class="flex items-center gap-2.5">
            <a
                href="/expenses"
                class="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500"
            >
                <ChevronLeft size={18} />
            </a>
            <h1 class="text-xl font-bold text-slate-900 font-display">รายละเอียด</h1>
        </div>

        <div class="relative">
            <button
                type="button"
                class="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500"
                aria-label="Open actions"
                on:click={() => (showActions = !showActions)}
            >
                <MoreHorizontal size={16} />
            </button>

            {#if showActions}
                <div class="absolute right-0 top-11 z-20 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg" in:scale out:fade>
                    <a href={`/expenses/${data.expense.id}/edit`} class="flex items-center gap-2.5 px-3.5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        <Pencil size={15} />
                        แก้ไข
                    </a>
                    <form
                        action="?/delete"
                        method="POST"
                        use:enhance={({ cancel }) => {
                            if (!confirm("คุณแน่ใจหรือไม่ที่จะลบรายการนี้?")) cancel();
                        }}
                    >
                        <button type="submit" class="flex w-full items-center gap-2.5 px-3.5 py-3 text-left text-sm font-medium text-rose-600 hover:bg-rose-50">
                            <Trash2 size={15} />
                            ลบรายการ
                        </button>
                    </form>
                </div>
            {/if}
        </div>
    </div>

    <section class={`surface-card p-5 text-white ${
        data.actionState.canReimburse ? "bg-amber-500 border-amber-500" : "bg-emerald-600 border-emerald-600"
    }`}>
        <div class="flex items-center gap-1.5 text-xs font-medium opacity-80 mb-3">
            <Wallet size={12} />
            {data.actionState.statusLabel}
        </div>

        <div class="text-3xl font-bold font-display">{formatCurrency(data.expense.amount)}</div>
        <h2 class="mt-2 text-lg font-bold font-display">{data.expense.description}</h2>

        <div class="mt-2 flex items-center gap-2">
            <span class="text-xs font-medium opacity-70">{data.expense.projects?.name || "ไม่ระบุโปรเจค"}</span>
        </div>
    </section>

    <section class="surface-card p-4">
        <h2 class="text-sm font-semibold text-slate-900 mb-3">ข้อมูลหลัก</h2>

        <div class="grid gap-2">
            <div class="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
                <Clock3 size={15} class="text-slate-400" />
                <div>
                    <div class="text-sm font-medium text-slate-900">{formatDate(data.expense.paid_at)}</div>
                    <div class="text-xs text-slate-500">{data.expense.transaction_type === "expense" ? "วันที่จ่าย" : "วันที่รับเงิน"}</div>
                </div>
            </div>

            <div class="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
                <User size={15} class="text-slate-400" />
                <div>
                    <div class="text-sm font-medium text-slate-900">{data.expense.profiles?.display_name || "ไม่ระบุ"}</div>
                    <div class="text-xs text-slate-500">{data.expense.transaction_type === "expense" ? "ผู้สำรองจ่าย" : "ผู้รับเงิน"}</div>
                </div>
            </div>

            {#if data.expense.category}
                <div class="rounded-lg bg-slate-50 px-3 py-2.5">
                    <div class="text-xs text-slate-500">หมวดหมู่</div>
                    <div class="text-sm font-medium text-slate-900">{data.expense.category}</div>
                </div>
            {/if}

            {#if data.expense.notes}
                <div class="rounded-lg bg-slate-50 px-3 py-2.5">
                    <div class="text-xs text-slate-500">หมายเหตุ</div>
                    <div class="mt-0.5 text-sm text-slate-700">{data.expense.notes}</div>
                </div>
            {/if}
        </div>
    </section>

    <section class="surface-card p-4">
        <h2 class="text-sm font-semibold text-slate-900 mb-3">Timeline</h2>

        <div class="space-y-3">
            <div class="flex items-center gap-2.5">
                <div class="h-2 w-2 rounded-full bg-indigo-500"></div>
                <div>
                    <span class="text-sm font-medium text-slate-900">สร้างรายการ</span>
                    <span class="text-xs text-slate-500 ml-2">{formatDate(data.expense.paid_at)}</span>
                </div>
            </div>

            {#if data.expense.is_reimbursed && data.expense.reimbursed_at}
                <div class="flex items-center gap-2.5">
                    <div class="h-2 w-2 rounded-full bg-emerald-500"></div>
                    <div>
                        <span class="text-sm font-medium text-slate-900">เคลียร์แล้ว</span>
                        <span class="text-xs text-slate-500 ml-2">
                            {formatDate(data.expense.reimbursed_at)}
                            {#if data.expense.reimburser}
                                · {data.expense.reimburser.display_name}
                            {/if}
                        </span>
                    </div>
                </div>
            {/if}

            {#if data.expense.attachments?.length || data.expense.proof_image_url}
                <div class="flex items-center gap-2.5">
                    <div class="h-2 w-2 rounded-full bg-slate-400"></div>
                    <div>
                        <span class="text-sm font-medium text-slate-900">แนบหลักฐาน</span>
                        <span class="text-xs text-slate-500 ml-2">
                            {data.expense.attachments?.length ? `${data.expense.attachments.length} รูป` : "1 รูป"}
                        </span>
                    </div>
                </div>
            {/if}
        </div>
    </section>

    {#if data.expense.attachments?.length || data.expense.proof_image_url || data.expense.reimbursement_proof_url}
        <section class="surface-card p-4">
            <h2 class="text-sm font-semibold text-slate-900 mb-3">หลักฐาน</h2>

            {#if data.expense.attachments?.length}
                <div class="grid grid-cols-2 gap-2">
                    {#each data.expense.attachments as attachment}
                        <a
                            href={attachment.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="group overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                        >
                            <img src={attachment.file_url} alt="Proof" class="h-32 w-full object-cover" />
                            <div class="flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-600">
                                หลักฐาน
                                <ExternalLink size={12} />
                            </div>
                        </a>
                    {/each}
                </div>
            {:else if data.expense.proof_image_url}
                <a
                    href={data.expense.proof_image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="group block overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                >
                    <img src={data.expense.proof_image_url} alt="Proof" class="max-h-64 w-full object-cover" />
                    <div class="flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-600">
                        หลักฐาน
                        <ExternalLink size={12} />
                    </div>
                </a>
            {/if}

            {#if data.expense.reimbursement_proof_url}
                <a
                    href={data.expense.reimbursement_proof_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="group mt-2 block overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50"
                >
                    <img
                        src={data.expense.reimbursement_proof_url}
                        alt="Reimbursement proof"
                        class="max-h-64 w-full object-cover"
                    />
                    <div class="flex items-center justify-between px-3 py-2 text-xs font-medium text-emerald-700">
                        หลักฐานโอนคืน
                        <ExternalLink size={12} />
                    </div>
                </a>
            {/if}
        </section>
    {/if}

    <div class="sticky-action-bar">
        <div class="mx-auto max-w-md">
            {#if data.actionState.canReimburse}
                <button
                    type="button"
                    class="btn-success"
                    on:click={() => (showReimburseSheet = true)}
                >
                    <CheckCircle2 size={16} />
                    ทำเครื่องหมายว่าเคลียร์แล้ว
                </button>
            {:else if data.expense.transaction_type === "expense"}
                <div class="space-y-2">
                    <div class="rounded-xl bg-emerald-50 px-3 py-2.5 text-center text-sm font-medium text-emerald-700">
                        เคลียร์เรียบร้อยแล้ว
                    </div>
                    <form action={`/expenses/${data.expense.id}?/unreimburse`} method="POST" use:enhance>
                        <button type="submit" class="btn-secondary w-full">
                            ย้อนกลับเป็นยังไม่เคลียร์
                        </button>
                    </form>
                </div>
            {/if}
        </div>
    </div>
</div>

{#if showReimburseSheet}
    <button
        type="button"
        class="fixed inset-0 z-[60] bg-black/30"
        aria-label="Close reimburse sheet"
        on:click={() => (showReimburseSheet = false)}
        in:fade={{ duration: 150 }}
        out:fade={{ duration: 100 }}
    ></button>

    <div class="sheet-panel max-w-md mx-auto" in:fly={{ y: 20, duration: 150 }} out:fly={{ y: 20, duration: 100 }}>
        <div class="mb-4 flex items-center justify-between">
            <h2 class="text-lg font-bold text-slate-900">ยืนยันการเคลียร์ยอด</h2>
            <button
                type="button"
                class="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                aria-label="Close reimburse sheet"
                on:click={() => (showReimburseSheet = false)}
            >
                <X size={18} />
            </button>
        </div>

        <form
            action={`/expenses/${data.expense.id}?/reimburse`}
            method="POST"
            enctype="multipart/form-data"
            use:enhance={() => {
                loading = true;
                return async ({ update }) => {
                    loading = false;
                    showReimburseSheet = false;
                    update();
                };
            }}
            class="space-y-3"
        >
            <input type="hidden" name="reimbursed_by" value={data.currentProfileId || ""} />

            <div>
                <div class="field-label">ผู้ยืนยัน</div>
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
                <div class="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                    <img src={reimburseProofPreviewUrl} alt="Reimbursement preview" class="max-h-48 w-full object-cover" />
                </div>
            {/if}

            <button
                type="submit"
                disabled={loading}
                class="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:bg-emerald-700"
            >
                {#if loading}
                    <Loader2 size={16} class="animate-spin" />
                    กำลังบันทึก...
                {:else}
                    ยืนยัน
                {/if}
            </button>
        </form>
    </div>
{/if}
