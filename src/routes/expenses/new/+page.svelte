<script lang="ts">
    import { ChevronLeft } from "lucide-svelte";
    import ExpenseForm from "$lib/components/ExpenseForm.svelte";

    export let data;
    export let form;
</script>

<div class="page-shell page-shell-actions">
    <div class="flex items-center gap-2.5">
        <a href="/expenses" class="icon-button" aria-label="กลับไปหน้ารายการ">
            <ChevronLeft size={18} />
        </a>
        <h1 class="page-title">เพิ่มรายการใหม่</h1>
    </div>

    <ExpenseForm
        mode="new"
        action="/expenses/new?/save"
        cancelHref="/expenses"
        submitLabel="บันทึกรายการ"
        projects={data.projects}
        profiles={data.profiles}
        currentProfileId={data.currentProfileId}
        currentUser={data.currentUser}
        formError={form?.error ?? null}
    />
</div>
