<script lang="ts">
    import { enhance } from "$app/forms";
    import {
        Shield,
        ShieldCheck,
        AlertTriangle,
        LogOut,
        KeyRound,
        Loader2,
    } from "lucide-svelte";
    import { fade, slide } from "svelte/transition";

    export let data;
    export let form;

    let loading = false;
    const formError = form?.error as string | undefined;
</script>

<div class="page-shell">
    <header class="px-1">
        <h1 class="text-2xl font-bold text-slate-900 font-display flex items-center gap-2">
            <Shield size={24} class="text-indigo-600" />
            ความปลอดภัย
        </h1>
    </header>

    <section class="surface-card p-5 space-y-5">
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <KeyRound size={15} class="text-indigo-600" />
                Two-Factor Auth (2FA)
            </div>
            {#if data.isEnabled}
                <span class="status-chip bg-emerald-50 text-emerald-700">
                    <ShieldCheck size={11} /> Active
                </span>
            {/if}
        </div>

        {#if data.isEnabled}
            <div class="flex items-start gap-3 rounded-xl bg-emerald-50 p-4" in:fade>
                <ShieldCheck size={18} class="text-emerald-600 shrink-0 mt-0.5" />
                <div>
                    <div class="text-sm font-medium text-emerald-900">เปิดใช้งานเรียบร้อยแล้ว</div>
                    <p class="text-xs text-emerald-600 mt-0.5">บัญชีของคุณได้รับการปกป้องด้วย 2FA</p>
                </div>
            </div>

            <form method="POST" action="?/disable" use:enhance>
                <button class="text-sm font-medium text-rose-600 hover:text-rose-700 transition">
                    ยกเลิกการใช้งาน 2FA
                </button>
            </form>
        {:else}
            <p class="text-sm text-slate-500">
                เพิ่มความปลอดภัยด้วยการยืนยันตัวตนสองขั้นตอน
            </p>

            {#if form?.qr}
                <div class="space-y-5" in:slide>
                    <div class="flex flex-col items-center p-6 bg-slate-50 rounded-xl">
                        <div class="p-3 bg-white rounded-xl shadow-sm mb-3">
                            <img
                                src={form.qr}
                                alt="QR Code"
                                class="w-36 h-36"
                            />
                        </div>
                        <p class="text-xs text-slate-500 text-center">
                            สแกนด้วย Google Authenticator
                        </p>
                    </div>

                    <form
                        method="POST"
                        action="?/verify"
                        use:enhance={() => {
                            loading = true;
                            return async ({ update }) => {
                                loading = false;
                                update();
                            };
                        }}
                        class="space-y-4"
                    >
                        <div>
                            <label for="code" class="field-label">รหัสยืนยัน 6 หลัก</label>
                            <input
                                type="text"
                                name="code"
                                id="code"
                                inputmode="numeric"
                                required
                                class="field-input text-center text-xl font-bold tracking-[0.4em] font-display"
                                placeholder="000000"
                            />
                            <input type="hidden" name="factorId" value={form.factorId} />
                            <input type="hidden" name="secret" value={form.secret} />
                        </div>

                        {#if formError}
                            <div class="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-100 p-3 text-xs font-medium text-rose-600">
                                <AlertTriangle size={14} />
                                {formError}
                            </div>
                        {/if}

                        <button
                            type="submit"
                            disabled={loading}
                            class="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                            {#if loading}
                                <Loader2 size={16} class="animate-spin" />
                                ตรวจสอบ...
                            {:else}
                                ยืนยันและเปิดใช้งาน
                            {/if}
                        </button>
                    </form>
                </div>
            {:else}
                <form method="POST" action="?/enroll" use:enhance>
                    {#if formError}
                        <div class="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-100 p-3 text-xs font-medium text-rose-600 mb-3">
                            <AlertTriangle size={14} />
                            {formError}
                        </div>
                    {/if}
                    <button
                        type="submit"
                        class="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
                    >
                        เริ่มตั้งค่า 2FA
                    </button>
                </form>
            {/if}
        {/if}
    </section>

    <form method="POST" action="?/logout" use:enhance>
        <button
            type="submit"
            class="w-full flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-100 transition-colors"
        >
            <LogOut size={16} />
            ออกจากระบบ
        </button>
    </form>
</div>
