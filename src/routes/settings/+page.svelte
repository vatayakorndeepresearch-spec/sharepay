<script lang="ts">
    import { enhance } from "$app/forms";
    import {
        Shield,
        ShieldCheck,
        AlertTriangle,
        LogOut,
        ChevronLeft,
        KeyRound,
        Sparkles,
    } from "lucide-svelte";
    import { fade, slide, fly, scale } from "svelte/transition";

    export let data;
    export let form;

    let loading = false;
</script>

<div class="max-w-md mx-auto space-y-8 pb-24">
    <div class="px-1">
        <h1
            class="text-3xl font-black text-slate-900 font-display tracking-tight flex items-center gap-3"
        >
            <Shield size={32} class="text-indigo-600" />
            ความปลอดภัย
        </h1>
        <p
            class="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1"
        >
            จัดการการเข้าถึงบัญชีของคุณ
        </p>
    </div>

    <div
        class="bg-white/80 backdrop-blur-md rounded-[32px] p-8 border border-white shadow-sm premium-shadow space-y-8"
    >
        <div>
            <div class="flex items-center justify-between mb-4">
                <h2
                    class="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2"
                >
                    <KeyRound size={14} class="text-indigo-600" /> Two-Factor Auth
                    (2FA)
                </h2>
                {#if data.isEnabled}
                    <span
                        class="bg-emerald-50 text-emerald-600 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-100 uppercase tracking-widest inline-flex items-center gap-1"
                    >
                        <ShieldCheck size={10} strokeWidth={3} /> Active
                    </span>
                {/if}
            </div>

            {#if data.isEnabled}
                <div
                    class="bg-emerald-50/50 border border-emerald-100/50 rounded-2xl p-5 flex items-start gap-3"
                    in:fade
                >
                    <div
                        class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0"
                    >
                        <ShieldCheck size={20} />
                    </div>
                    <div>
                        <h3 class="font-bold text-emerald-900 text-sm">
                            เปิดใช้งานเรียบร้อยแล้ว
                        </h3>
                        <p
                            class="text-[11px] text-emerald-600 font-medium leading-relaxed mt-1"
                        >
                            บัญชีของคุณได้รับการปกป้องด้วยการยืนยันตัวตนสองขั้นตอน
                            (2FA) แล้วในขณะนี้
                        </p>
                    </div>
                </div>

                <form method="POST" action="?/disable" use:enhance class="mt-6">
                    <button
                        class="text-rose-600 text-[11px] font-black uppercase tracking-widest hover:text-rose-700 transition flex items-center gap-2 px-1"
                    >
                        ยกเลิกการใช้งาน 2FA
                    </button>
                </form>
            {:else}
                <p
                    class="text-slate-500 mb-6 text-sm font-medium leading-relaxed px-1"
                >
                    เพิ่มความปลอดภัยให้บัญชีของคุณด้วยการยืนยันตัวตนสองขั้นตอน
                    เพื่อป้องกันการเข้าถึงจากบุคคลอื่น
                </p>

                {#if form?.qr}
                    <div class="space-y-8" in:slide>
                        <div
                            class="flex flex-col items-center p-8 bg-slate-50 rounded-[28px] border border-slate-100 shadow-inner group"
                        >
                            <div
                                class="p-4 bg-white rounded-2xl shadow-sm mb-4 group-hover:scale-105 transition-transform duration-500"
                            >
                                <img
                                    src={form.qr}
                                    alt="QR Code"
                                    class="w-40 h-40 mix-blend-multiply"
                                />
                            </div>
                            <p
                                class="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center mt-2 leading-loose"
                            >
                                สแกนด้วยแอปยืนยันตัวตน<br />(Google
                                Authenticator)
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
                            class="space-y-5"
                        >
                            <div>
                                <label
                                    for="code"
                                    class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1"
                                >
                                    รหัสยืนยัน 6 หลัก
                                </label>
                                <input
                                    type="text"
                                    name="code"
                                    id="code"
                                    inputmode="numeric"
                                    required
                                    class="w-full bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500/20 py-4 px-4 text-2xl font-black font-display tracking-[0.5em] text-center"
                                    placeholder="000000"
                                />
                                <input
                                    type="hidden"
                                    name="factorId"
                                    value={form.factorId}
                                />
                                <input
                                    type="hidden"
                                    name="secret"
                                    value={form.secret}
                                />
                            </div>

                            {#if form?.error}
                                <div
                                    class="bg-rose-50 text-rose-600 p-4 rounded-2xl text-xs font-bold border border-rose-100 flex items-center gap-2"
                                    in:shake
                                >
                                    <AlertTriangle size={16} />
                                    {form.error}
                                </div>
                            {/if}

                            <button
                                type="submit"
                                disabled={loading}
                                class="w-full bg-indigo-600 text-white py-4 rounded-[22px] font-black font-display tracking-tight hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 transition-all"
                            >
                                {#if loading}
                                    <Sparkles class="animate-pulse" size={24} />
                                    <span>ตรวจสอบข้อมูล...</span>
                                {:else}
                                    <span>ยืนยันและเปิดใช้งาน</span>
                                {/if}
                            </button>
                        </form>
                    </div>
                {:else}
                    <form method="POST" action="?/enroll" use:enhance>
                        {#if form?.error}
                            <div
                                class="bg-rose-50 text-rose-600 p-4 rounded-2xl text-xs font-bold border border-rose-100 flex items-center gap-2 mb-4"
                            >
                                <AlertTriangle size={16} />
                                {form.error}
                            </div>
                        {/if}
                        <button
                            type="submit"
                            class="w-full bg-indigo-600 text-white py-4 rounded-[22px] font-black font-display tracking-tight hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-3 active:scale-95 transition-all"
                        >
                            เริ่มการตั้งค่าความปลอดภัย
                        </button>
                    </form>
                {/if}
            {/if}
        </div>
    </div>

    <form method="POST" action="?/logout" use:enhance class="pt-4">
        <button
            type="submit"
            class="w-full bg-rose-50 text-rose-600 py-4 rounded-[22px] font-black font-display tracking-tight hover:bg-rose-100 border border-rose-100 flex items-center justify-center gap-3 active:scale-95 transition-all group"
        >
            <LogOut
                size={20}
                class="group-hover:-translate-x-1 transition-transform"
            />
            <span>ออกจากระบบ</span>
        </button>
    </form>
</div>
