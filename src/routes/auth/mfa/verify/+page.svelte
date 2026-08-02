<script lang="ts">
    import { enhance } from "$app/forms";
    import { AlertTriangle, Loader2, ShieldCheck } from "lucide-svelte";

    export let form;

    let loading = false;
    let code = "";
    let formEl: HTMLFormElement;

    function onInput(event: Event) {
        const input = event.currentTarget as HTMLInputElement;
        code = input.value.replace(/\D/g, "").slice(0, 6);
        input.value = code;

        // Authenticator codes are always 6 digits — submit as soon as one is complete.
        if (code.length === 6 && !loading) {
            formEl.requestSubmit();
        }
    }
</script>

<div class="flex min-h-screen flex-col justify-center px-4 py-10">
    <div class="mx-auto w-full max-w-sm">
        <div class="mb-8 text-center">
            <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-white">
                <ShieldCheck size={28} />
            </div>
            <h1 class="text-2xl font-bold text-text font-display">ยืนยันตัวตน 2 ขั้นตอน</h1>
            <p class="mt-1.5 text-sm text-muted">กรอกรหัส 6 หลักจากแอป Google Authenticator</p>
        </div>

        <div class="surface-card p-6">
            {#if form?.error}
                <div class="mb-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger-on-soft">
                    <AlertTriangle size={16} class="mt-0.5 shrink-0" />
                    {form.error}
                </div>
            {/if}

            <form
                bind:this={formEl}
                method="POST"
                action="?/verify"
                use:enhance={() => {
                    loading = true;
                    return async ({ update }) => {
                        loading = false;
                        code = "";
                        await update();
                    };
                }}
                class="space-y-4"
            >
                <div>
                    <label for="code" class="field-label">รหัสความปลอดภัย</label>
                    <input
                        id="code"
                        name="code"
                        type="text"
                        inputmode="numeric"
                        autocomplete="one-time-code"
                        maxlength="6"
                        required
                        value={code}
                        on:input={onInput}
                        class="field-input text-center text-2xl font-bold tracking-[0.5em] font-display"
                        placeholder="000000"
                    />
                </div>

                <button type="submit" disabled={loading || code.length !== 6} class="btn-primary w-full">
                    {#if loading}
                        <Loader2 size={16} class="animate-spin" />
                        กำลังตรวจสอบ...
                    {:else}
                        ยืนยันรหัส
                    {/if}
                </button>
            </form>
        </div>
    </div>
</div>
