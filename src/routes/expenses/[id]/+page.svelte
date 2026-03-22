<script lang="ts">
    import { enhance } from "$app/forms";
    import { formatCurrency } from "$lib/utils/formatCurrency";
    import { formatDate } from "$lib/utils/formatDate";
    import {
        CheckCircle2,
        ChevronLeft,
        Clock3,
        ExternalLink,
        FileText,
        Loader2,
        MoreHorizontal,
        Pencil,
        Receipt,
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

<div class="page-shell pb-40">
    <div class="flex items-center justify-between gap-3 px-1">
        <div class="flex items-center gap-3">
            <a
                href="/expenses"
                class="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500"
            >
                <ChevronLeft size={20} />
            </a>
            <div>
                <p class="eyebrow">Detail</p>
                <h1 class="text-2xl font-black text-slate-900 font-display">รายละเอียดรายการ</h1>
            </div>
        </div>

        <div class="relative">
            <button
                type="button"
                class="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500"
                aria-label="Open actions"
                on:click={() => (showActions = !showActions)}
            >
                <MoreHorizontal size={18} />
            </button>

            {#if showActions}
                <div class="absolute right-0 top-12 z-20 w-48 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-xl" in:scale out:fade>
                    <a href={`/expenses/${data.expense.id}/edit`} class="flex items-center gap-3 px-4 py-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                        <Pencil size={16} />
                        แก้ไขรายการ
                    </a>
                    <form
                        action="?/delete"
                        method="POST"
                        use:enhance={({ cancel }) => {
                            if (!confirm("คุณแน่ใจหรือไม่ที่จะลบรายการนี้?")) cancel();
                        }}
                    >
                        <button type="submit" class="flex w-full items-center gap-3 px-4 py-4 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50">
                            <Trash2 size={16} />
                            ลบรายการ
                        </button>
                    </form>
                </div>
            {/if}
        </div>
    </div>

    <section class={`overflow-hidden rounded-[32px] p-6 text-white premium-shadow ${
        data.actionState.canReimburse ? "bg-gradient-to-br from-amber-500 to-orange-600" : "bg-gradient-to-br from-emerald-600 to-emerald-700"
    }`}>
        <div class="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold">
            <Wallet size={13} />
            {data.actionState.statusLabel}
        </div>

        <div class="flex items-start justify-between gap-4">
            <div>
                <div class="text-4xl font-black font-display tracking-tight">{formatCurrency(data.expense.amount)}</div>
                <h2 class="mt-3 text-2xl font-black font-display">{data.expense.description}</h2>
                <p class="mt-2 max-w-[28ch] text-sm text-white/80">
                    {data.actionState.canReimburse
                        ? "รายการนี้ยังอยู่ในคิวที่ต้องเคลียร์ ถ้าจ่ายคืนแล้วให้ยืนยันจากปุ่มด้านล่าง"
                        : "รายการนี้ปิดเรียบร้อยแล้ว รายละเอียดการคืนเงินและหลักฐานอยู่ด้านล่าง"}
                </p>
            </div>
            <div class="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
                {data.expense.projects?.name || "ไม่ระบุโปรเจค"}
            </div>
        </div>
    </section>

    <section class="surface-card p-5">
        <div class="mb-4">
            <h2 class="text-lg font-black text-slate-900 font-display">ข้อมูลหลัก</h2>
            <p class="text-sm text-slate-500">เช็ก metadata สำคัญก่อนทำ action ต่อ</p>
        </div>

        <div class="grid gap-3">
            <div class="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-600">
                    <Clock3 size={16} />
                </div>
                <div>
                    <div class="text-sm font-semibold text-slate-900">{formatDate(data.expense.paid_at)}</div>
                    <div class="text-sm text-slate-500">{data.expense.transaction_type === "expense" ? "วันที่จ่าย" : "วันที่รับเงิน"}</div>
                </div>
            </div>

            <div class="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-600">
                    <User size={16} />
                </div>
                <div>
                    <div class="text-sm font-semibold text-slate-900">{data.expense.profiles?.display_name || "ไม่ระบุ"}</div>
                    <div class="text-sm text-slate-500">{data.expense.transaction_type === "expense" ? "ผู้สำรองจ่าย" : "ผู้รับเงิน"}</div>
                </div>
            </div>

            {#if data.expense.category}
                <div class="rounded-2xl bg-slate-50 px-4 py-3">
                    <div class="text-sm text-slate-500">หมวดหมู่</div>
                    <div class="mt-1 text-sm font-semibold text-slate-900">{data.expense.category}</div>
                </div>
            {/if}

            {#if data.expense.notes}
                <div class="rounded-2xl bg-slate-50 px-4 py-3">
                    <div class="text-sm text-slate-500">หมายเหตุ</div>
                    <div class="mt-1 text-sm font-medium text-slate-700">{data.expense.notes}</div>
                </div>
            {/if}
        </div>
    </section>

    <section class="surface-card p-5">
        <div class="mb-4">
            <h2 class="text-lg font-black text-slate-900 font-display">Timeline</h2>
            <p class="text-sm text-slate-500">สรุปลำดับเหตุการณ์ของรายการนี้แบบสั้นและชัด</p>
        </div>

        <div class="space-y-4">
            <div class="flex gap-3">
                <div class="mt-1 h-3 w-3 rounded-full bg-indigo-500"></div>
                <div>
                    <div class="text-sm font-semibold text-slate-900">สร้างรายการ</div>
                    <div class="text-sm text-slate-500">{formatDate(data.expense.paid_at)}</div>
                </div>
            </div>

            {#if data.expense.is_reimbursed && data.expense.reimbursed_at}
                <div class="flex gap-3">
                    <div class="mt-1 h-3 w-3 rounded-full bg-emerald-500"></div>
                    <div>
                        <div class="text-sm font-semibold text-slate-900">เคลียร์ยอดแล้ว</div>
                        <div class="text-sm text-slate-500">
                            {formatDate(data.expense.reimbursed_at)}
                            {#if data.expense.reimburser}
                                • โดย {data.expense.reimburser.display_name}
                            {/if}
                        </div>
                    </div>
                </div>
            {/if}

            {#if data.expense.attachments?.length || data.expense.proof_image_url}
                <div class="flex gap-3">
                    <div class="mt-1 h-3 w-3 rounded-full bg-slate-400"></div>
                    <div>
                        <div class="text-sm font-semibold text-slate-900">แนบหลักฐานการจ่าย</div>
                        <div class="text-sm text-slate-500">
                            {data.expense.attachments?.length ? `${data.expense.attachments.length} รูป` : "มีหลักฐาน 1 รูป"}
                        </div>
                    </div>
                </div>
            {/if}
        </div>
    </section>

    <section class="surface-card p-5">
        <div class="mb-4">
            <h2 class="text-lg font-black text-slate-900 font-display">หลักฐาน</h2>
            <p class="text-sm text-slate-500">รวมรูปหลักฐานการจ่ายและการโอนคืนไว้ในที่เดียว</p>
        </div>

        {#if data.expense.attachments?.length}
            <div class="grid grid-cols-2 gap-3">
                {#each data.expense.attachments as attachment}
                    <a
                        href={attachment.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="group overflow-hidden rounded-[24px] border border-slate-200 bg-slate-100"
                    >
                        <img src={attachment.file_url} alt="Proof" class="h-40 w-full object-cover transition group-hover:scale-105" />
                        <div class="flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700">
                            หลักฐานการจ่าย
                            <ExternalLink size={14} />
                        </div>
                    </a>
                {/each}
            </div>
        {:else if data.expense.proof_image_url}
            <a
                href={data.expense.proof_image_url}
                target="_blank"
                rel="noopener noreferrer"
                class="group block overflow-hidden rounded-[24px] border border-slate-200 bg-slate-100"
            >
                <img src={data.expense.proof_image_url} alt="Proof" class="max-h-80 w-full object-cover transition group-hover:scale-105" />
                <div class="flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700">
                    หลักฐานการจ่าย
                    <ExternalLink size={14} />
                </div>
            </a>
        {/if}

        {#if data.expense.reimbursement_proof_url}
            <a
                href={data.expense.reimbursement_proof_url}
                target="_blank"
                rel="noopener noreferrer"
                class="group mt-3 block overflow-hidden rounded-[24px] border border-emerald-200 bg-emerald-50"
            >
                <img
                    src={data.expense.reimbursement_proof_url}
                    alt="Reimbursement proof"
                    class="max-h-80 w-full object-cover transition group-hover:scale-105"
                />
                <div class="flex items-center justify-between px-4 py-3 text-sm font-semibold text-emerald-700">
                    หลักฐานการโอนคืน
                    <ExternalLink size={14} />
                </div>
            </a>
        {/if}
    </section>

    <div class="sticky-action-bar">
        <div class="mx-auto max-w-md">
            {#if data.actionState.canReimburse}
                <button
                    type="button"
                    class="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white"
                    on:click={() => (showReimburseSheet = true)}
                >
                    <CheckCircle2 size={18} />
                    ทำเครื่องหมายว่าเคลียร์แล้ว
                </button>
            {:else if data.expense.transaction_type === "expense"}
                <div class="space-y-2">
                    <div class="rounded-2xl bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-700">
                        รายการนี้เคลียร์เรียบร้อยแล้ว
                    </div>
                    <form action={`/expenses/${data.expense.id}?/unreimburse`} method="POST" use:enhance>
                        <button type="submit" class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600">
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
        class="fixed inset-0 z-[60] bg-slate-950/35 backdrop-blur-sm"
        aria-label="Close reimburse sheet"
        on:click={() => (showReimburseSheet = false)}
        in:fade
        out:fade
    ></button>

    <div class="sheet-panel max-w-md mx-auto" in:fly={{ y: 20, duration: 180 }} out:fly={{ y: 20, duration: 140 }}>
        <div class="mb-5 flex items-center justify-between">
            <div>
                <p class="eyebrow">Settlement</p>
                <h2 class="text-xl font-black text-slate-900 font-display">ยืนยันการเคลียร์ยอด</h2>
            </div>
            <button
                type="button"
                class="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-500"
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
            class="space-y-4"
        >
            <input type="hidden" name="reimbursed_by" value={data.currentProfileId || ""} />

            <div>
                <div class="field-label">คนที่ยืนยันการคืนเงิน</div>
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
                        <div class="text-xs text-slate-500">ยึดจากบัญชีผู้ใช้ปัจจุบัน</div>
                    </div>
                </div>
            </div>

            <div>
                <label class="field-label" for="proof_image">หลักฐานการโอนคืน (ไม่บังคับ)</label>
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
                <div class="overflow-hidden rounded-[24px] border border-slate-200 bg-slate-100">
                    <img src={reimburseProofPreviewUrl} alt="Reimbursement preview" class="max-h-72 w-full object-cover" />
                </div>
            {/if}

            <button
                type="submit"
                disabled={loading}
                class="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
                {#if loading}
                    <Loader2 size={18} class="animate-spin" />
                    กำลังบันทึก...
                {:else}
                    ยืนยันการเคลียร์ยอด
                {/if}
            </button>
        </form>
    </div>
{/if}
