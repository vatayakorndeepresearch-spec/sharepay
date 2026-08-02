<script lang="ts">
    import { enhance } from "$app/forms";
    import {
        AlertTriangle,
        Briefcase,
        Download,
        KeyRound,
        Loader2,
        LogOut,
        Moon,
        Plus,
        ShieldCheck,
        Sun,
    } from "lucide-svelte";
    import { fade, slide } from "svelte/transition";
    import IdentityChip from "$lib/components/IdentityChip.svelte";
    import { motion } from "$lib/motion";
    import { theme } from "$lib/stores/theme";
    import { toasts } from "$lib/stores/toast";

    export let data;
    export let form;

    let verifying = false;
    let creatingProject = false;
    let newProjectName = "";

    $: formError = form?.error as string | undefined;
</script>

<div class="page-shell">
    <header>
        <h1 class="page-title">ตั้งค่า</h1>
    </header>

    <section class="surface-card space-y-3 p-4">
        <h2 class="section-label">โปรไฟล์</h2>
        <IdentityChip
            name={data.currentUser?.name}
            avatarUrl={data.currentUser?.avatar_url}
            caption={data.currentUser?.email || "บัญชีปัจจุบัน"}
        />
    </section>

    <section class="surface-card space-y-3 p-4">
        <h2 class="section-label">การแสดงผล</h2>
        <div class="flex items-center justify-between gap-3">
            <div>
                <div class="text-sm font-medium text-text">โหมดมืด</div>
                <p class="text-xs text-muted">ค่าเริ่มต้นตามระบบของเครื่อง</p>
            </div>
            <button
                type="button"
                class="flex items-center gap-2 rounded-xl border border-border bg-surface-muted px-3.5 py-2.5 text-sm font-medium text-soft transition-colors hover:bg-border"
                aria-pressed={$theme === "dark"}
                on:click={() => theme.set($theme === "dark" ? "light" : "dark")}
            >
                {#if $theme === "dark"}
                    <Moon size={16} />
                    มืด
                {:else}
                    <Sun size={16} />
                    สว่าง
                {/if}
            </button>
        </div>
    </section>

    <section class="surface-card space-y-3 p-4">
        <h2 class="section-label">โปรเจค</h2>

        {#if data.projects.length === 0}
            <p class="text-sm text-muted">ยังไม่มีโปรเจค สร้างอันแรกด้านล่าง</p>
        {:else}
            <div class="grid gap-2">
                {#each data.projects as project (project.id)}
                    <div class="flex items-center justify-between gap-3 rounded-xl bg-surface-muted px-3 py-2.5">
                        <div class="flex min-w-0 items-center gap-2.5">
                            <Briefcase size={15} class="shrink-0 text-muted" />
                            <span class="truncate text-sm font-medium text-text">{project.name}</span>
                        </div>
                        <form
                            method="POST"
                            action="?/toggleProject"
                            use:enhance={() => async ({ update }) => {
                                toasts.success(project.is_active ? "ปิดใช้งานโปรเจคแล้ว" : "เปิดใช้งานโปรเจคแล้ว");
                                await update();
                            }}
                        >
                            <input type="hidden" name="project_id" value={project.id} />
                            <input type="hidden" name="is_active" value={String(project.is_active)} />
                            <button
                                type="submit"
                                class={`status-chip ${project.is_active ? "status-chip-cleared" : "bg-surface text-muted"}`}
                            >
                                {project.is_active ? "ใช้งานอยู่" : "ปิดอยู่"}
                            </button>
                        </form>
                    </div>
                {/each}
            </div>
        {/if}

        <form
            method="POST"
            action="?/createProject"
            class="flex gap-2"
            use:enhance={() => {
                creatingProject = true;
                return async ({ result, update }) => {
                    creatingProject = false;
                    if (result.type === "success") {
                        newProjectName = "";
                        toasts.success("สร้างโปรเจคแล้ว");
                    }
                    await update({ reset: false });
                };
            }}
        >
            <label class="sr-only" for="new-project">ชื่อโปรเจคใหม่</label>
            <input
                id="new-project"
                name="name"
                type="text"
                class="field-input"
                placeholder="ชื่อโปรเจคใหม่"
                bind:value={newProjectName}
            />
            <button type="submit" class="btn-primary shrink-0 px-4" disabled={creatingProject || !newProjectName.trim()}>
                {#if creatingProject}
                    <Loader2 size={16} class="animate-spin" />
                {:else}
                    <Plus size={16} />
                {/if}
            </button>
        </form>
    </section>

    <section class="surface-card space-y-4 p-4">
        <div class="flex items-center justify-between">
            <h2 class="section-label">ความปลอดภัย</h2>
            {#if data.isEnabled}
                <span class="status-chip status-chip-cleared">
                    <ShieldCheck size={11} />
                    เปิดอยู่
                </span>
            {/if}
        </div>

        <div class="flex items-center gap-2 text-sm font-semibold text-text">
            <KeyRound size={15} class="text-accent" />
            การยืนยันตัวตนสองขั้นตอน (2FA)
        </div>

        {#if data.isEnabled}
            <div
                class="flex items-start gap-3 rounded-xl bg-income-soft p-4"
                in:fade={{ duration: motion.duration.base, easing: motion.easing.enter }}
            >
                <ShieldCheck size={18} class="mt-0.5 shrink-0 text-income" />
                <div>
                    <div class="text-sm font-medium text-income-on-soft">เปิดใช้งานเรียบร้อยแล้ว</div>
                    <p class="mt-0.5 text-xs text-income-on-soft/80">บัญชีของคุณได้รับการปกป้องด้วย 2FA</p>
                </div>
            </div>

            <form
                method="POST"
                action="?/disable"
                use:enhance={({ cancel }) => {
                    if (!confirm("ปิดการใช้งาน 2FA ใช่หรือไม่? บัญชีจะปลอดภัยน้อยลง")) {
                        cancel();
                        return;
                    }
                    return async ({ update }) => {
                        toasts.info("ปิดการใช้งาน 2FA แล้ว");
                        await update();
                    };
                }}
            >
                <button type="submit" class="text-sm font-medium text-danger-on-soft">ยกเลิกการใช้งาน 2FA</button>
            </form>
        {:else}
            <p class="text-sm text-muted">เพิ่มความปลอดภัยด้วยการยืนยันตัวตนสองขั้นตอน</p>

            {#if formError}
                <div class="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger-soft p-3 text-xs font-medium text-danger-on-soft">
                    <AlertTriangle size={14} />
                    {formError}
                </div>
            {/if}

            {#if form?.qr}
                <div
                    class="space-y-4"
                    in:slide={{ duration: motion.duration.slow, easing: motion.easing.enter }}
                >
                    <div class="flex flex-col items-center rounded-xl bg-surface-muted p-6">
                        <div class="mb-3 rounded-xl bg-white p-3">
                            <img src={form.qr} alt="QR code สำหรับตั้งค่า 2FA" class="h-36 w-36" />
                        </div>
                        <p class="text-center text-xs text-muted">สแกนด้วย Google Authenticator</p>
                    </div>

                    <form
                        method="POST"
                        action="?/verify"
                        use:enhance={() => {
                            verifying = true;
                            return async ({ result, update }) => {
                                verifying = false;
                                if (result.type === "success") toasts.success("เปิดใช้งาน 2FA แล้ว");
                                await update();
                            };
                        }}
                        class="space-y-3"
                    >
                        <div>
                            <label for="code" class="field-label">รหัสยืนยัน 6 หลัก</label>
                            <input
                                type="text"
                                name="code"
                                id="code"
                                inputmode="numeric"
                                maxlength="6"
                                autocomplete="one-time-code"
                                required
                                class="field-input text-center text-xl font-bold tracking-[0.4em] font-display"
                                placeholder="000000"
                            />
                            <input type="hidden" name="factorId" value={form.factorId} />
                        </div>

                        <button type="submit" disabled={verifying} class="btn-primary w-full">
                            {#if verifying}
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
                    <button type="submit" class="btn-primary w-full">เริ่มตั้งค่า 2FA</button>
                </form>
            {/if}
        {/if}
    </section>

    <section class="surface-card space-y-3 p-4">
        <h2 class="section-label">ข้อมูล</h2>
        <div class="grid grid-cols-2 gap-2">
            <a href="/expenses/export?format=xlsx" download class="btn-secondary text-sm">
                <Download size={14} />
                Excel ทั้งหมด
            </a>
            <a href="/expenses/export?format=csv" download class="btn-secondary text-sm">
                <Download size={14} />
                CSV ทั้งหมด
            </a>
        </div>
    </section>

    <form
        method="POST"
        action="?/logout"
        use:enhance={({ cancel }) => {
            if (!confirm("ออกจากระบบใช่หรือไม่?")) cancel();
        }}
    >
        <button type="submit" class="btn-danger-soft">
            <LogOut size={16} />
            ออกจากระบบ
        </button>
    </form>
</div>
