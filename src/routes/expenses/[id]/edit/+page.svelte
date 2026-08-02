<script lang="ts">
    import { applyAction, enhance } from "$app/forms";
    import { invalidateAll } from "$app/navigation";
    import { ChevronLeft } from "lucide-svelte";
    import ExpenseForm from "$lib/components/ExpenseForm.svelte";
    import { toasts } from "$lib/stores/toast";

    export let data;
    export let form;

    $: detailHref = `/expenses/${data.expense.id}`;
</script>

<div class="page-shell page-shell-actions">
    <div class="flex items-center gap-2.5">
        <a href={detailHref} class="icon-button" aria-label="กลับไปหน้ารายละเอียด">
            <ChevronLeft size={18} />
        </a>
        <h1 class="page-title">แก้ไขรายการ</h1>
    </div>

    <ExpenseForm
        mode="edit"
        action="?/update"
        cancelHref={detailHref}
        submitLabel="บันทึกการแก้ไข"
        projects={data.projects}
        profiles={data.profiles}
        currentProfileId={data.currentProfileId}
        currentUser={data.currentUser}
        attachments={data.expense.attachments}
        attachmentDeleteFormId="attachment-delete"
        formError={form?.error ?? null}
        initial={{
            transaction_type: data.expense.transaction_type,
            amount: data.expense.amount,
            paid_at: data.expense.paid_at,
            description: data.expense.description,
            notes: data.expense.notes,
            category: data.expense.category,
            project_id: data.expense.project_id,
            paid_by: data.expense.paid_by,
        }}
    />

    <!-- Standalone target for the per-attachment delete buttons so they never submit
         (or reset) the main edit form. -->
    <form
        id="attachment-delete"
        method="POST"
        action="?/deleteAttachment"
        use:enhance={() => async ({ result }) => {
            if (result.type === "success") {
                toasts.success("ลบรูปแล้ว");
                await invalidateAll();
            } else {
                await applyAction(result);
            }
        }}
    ></form>
</div>
