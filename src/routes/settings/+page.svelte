<script lang="ts">
    import { enhance } from "$app/forms";
    import { Shield, ShieldCheck, AlertTriangle } from "lucide-svelte";

    export let data;
    export let form;

    let loading = false;
</script>

<div class="space-y-6">
    <h1 class="text-2xl font-bold text-gray-800 flex items-center gap-2">
        <Shield size={28} class="text-indigo-600" /> การตั้งค่าความปลอดภัย
    </h1>

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">
            Two-Factor Authentication (2FA)
        </h2>

        {#if data.isEnabled}
            <div
                class="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3"
            >
                <ShieldCheck class="text-green-600 mt-0.5" size={20} />
                <div>
                    <h3 class="font-medium text-green-900">เปิดใช้งานแล้ว</h3>
                    <p class="text-sm text-green-700 mt-1">
                        บัญชีของคุณได้รับการปกป้องด้วย 2FA
                    </p>
                </div>
            </div>

            <form method="POST" action="?/disable" use:enhance class="mt-4">
                <button class="text-red-600 text-sm hover:underline"
                    >ยกเลิกการใช้งาน 2FA</button
                >
            </form>
        {:else}
            <p class="text-gray-600 mb-6 text-sm">
                เพิ่มความปลอดภัยให้บัญชีของคุณด้วยการยืนยันตัวตนสองขั้นตอน
            </p>

            {#if form?.qr}
                <div class="space-y-6">
                    <div
                        class="flex flex-col items-center p-4 bg-gray-50 rounded-lg border border-gray-200"
                    >
                        <img
                            src={form.qr}
                            alt="QR Code"
                            class="w-48 h-48 mix-blend-multiply"
                        />
                        <p class="text-xs text-gray-500 mt-2 text-center">
                            สแกน QR Code นี้ด้วยแอป Google Authenticator
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
                            <label
                                for="code"
                                class="block text-sm font-medium text-gray-700"
                            >
                                รหัสยืนยัน 6 หลัก
                            </label>
                            <input
                                type="text"
                                name="code"
                                id="code"
                                inputmode="numeric"
                                required
                                class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
                                class="text-red-600 text-sm flex items-center gap-1"
                            >
                                <AlertTriangle size={14} />
                                {form.error}
                            </div>
                        {/if}

                        <button
                            type="submit"
                            disabled={loading}
                            class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                        >
                            {loading
                                ? "กำลังตรวจสอบ..."
                                : "ยืนยันและเปิดใช้งาน"}
                        </button>
                    </form>
                </div>
            {:else}
                <form method="POST" action="?/enroll" use:enhance>
                    {#if form?.error}
                        <div
                            class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-4 flex items-center gap-2"
                        >
                            <AlertTriangle size={16} />
                            {form.error}
                        </div>
                    {/if}
                    <button
                        type="submit"
                        class="w-full flex justify-center items-center gap-2 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        เริ่มการตั้งค่า
                    </button>
                </form>
            {/if}
        {/if}
    </div>

    <form method="POST" action="?/logout" use:enhance>
        <button
            type="submit"
            class="w-full flex justify-center items-center gap-2 py-3 px-4 border border-red-200 rounded-xl shadow-sm text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
        >
            ออกจากระบบ
        </button>
    </form>
</div>
