<script lang="ts">
    import { enhance } from "$app/forms";
    import { ShieldCheck, Lock } from "lucide-svelte";

    export let form;
    let loading = false;
</script>

<div
    class="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8"
>
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
        <div class="flex justify-center">
            <div class="bg-indigo-600 p-3 rounded-xl shadow-lg">
                <ShieldCheck class="text-white" size={32} />
            </div>
        </div>
        <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
            ยืนยันตัวตน 2 ขั้นตอน
        </h2>
        <p class="mt-2 text-center text-sm text-gray-600">
            กรุณากรอกรหัสจากแอป Google Authenticator
        </p>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div
            class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100"
        >
            {#if form?.error}
                <div
                    class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-6 flex items-center gap-2"
                >
                    <ShieldCheck size={16} />
                    {form.error}
                </div>
            {/if}

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
                class="space-y-6"
            >
                <div>
                    <label
                        for="code"
                        class="block text-sm font-medium text-gray-700"
                    >
                        รหัสความปลอดภัย 6 หลัก
                    </label>
                    <div class="mt-1 relative rounded-md shadow-sm">
                        <div
                            class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
                        >
                            <Lock class="text-gray-400" size={20} />
                        </div>
                        <input
                            id="code"
                            name="code"
                            type="text"
                            inputmode="numeric"
                            autocomplete="one-time-code"
                            required
                            class="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-lg"
                            placeholder="000000"
                        />
                    </div>
                </div>

                <div>
                    <button
                        type="submit"
                        disabled={loading}
                        class="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {#if loading}
                            กำลังตรวจสอบ...
                        {:else}
                            ยืนยันรหัส
                        {/if}
                    </button>
                </div>
            </form>
        </div>
    </div>
</div>
