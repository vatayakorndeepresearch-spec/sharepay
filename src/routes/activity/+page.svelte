<script lang="ts">
    import { enhance } from "$app/forms";
    import { invalidateAll } from "$app/navigation";
    import ActivityRow from "$lib/components/ActivityRow.svelte";
    import EmptyState from "$lib/components/EmptyState.svelte";
    import { toasts } from "$lib/stores/toast";
    import { History, Loader2, Undo2 } from "lucide-svelte";

    export let data;

    let undoingId: string | null = null;

    // Mirrors isUndoable() on the server: only settlement flips can be rolled back.
    const canUndo = (activity: (typeof data.activities)[number]) =>
        !activity.undone_at &&
        !!activity.expense_id &&
        (activity.action === "reimburse" || activity.action === "unreimburse");
</script>

<div class="page-shell enter">
    <header class="px-1">
        <h1 class="page-title">ความเคลื่อนไหว</h1>
        <p class="text-sm text-muted">ทุกการเพิ่ม แก้ไข เคลียร์ยอด และลบรายการ</p>
    </header>

    {#if data.activities.length === 0}
        <EmptyState
            icon={History}
            title="ยังไม่มีความเคลื่อนไหว"
            description="เมื่อมีการเพิ่ม แก้ไข หรือเคลียร์ยอด รายการจะขึ้นที่นี่"
        />
    {:else}
        <div class="surface-card divide-y divide-border overflow-hidden">
            {#each data.activities as activity (activity.id)}
                <ActivityRow {activity}>
                    <svelte:fragment slot="undo">
                        {#if canUndo(activity)}
                            <form
                                method="POST"
                                action="?/undo"
                                use:enhance={() => {
                                    undoingId = activity.id;
                                    return async ({ result }) => {
                                        undoingId = null;
                                        if (result.type === "success") {
                                            toasts.success("ย้อนกลับเรียบร้อย");
                                            await invalidateAll();
                                        } else {
                                            toasts.error("ย้อนกลับไม่สำเร็จ");
                                        }
                                    };
                                }}
                            >
                                <input type="hidden" name="activity_id" value={activity.id} />
                                <button
                                    type="submit"
                                    disabled={undoingId === activity.id}
                                    class="flex items-center gap-1 rounded-lg bg-surface-muted px-2 py-1 text-xs font-medium text-soft transition-colors hover:bg-border disabled:opacity-60"
                                >
                                    {#if undoingId === activity.id}
                                        <Loader2 size={12} class="animate-spin" />
                                    {:else}
                                        <Undo2 size={12} />
                                    {/if}
                                    ย้อนกลับ
                                </button>
                            </form>
                        {/if}
                    </svelte:fragment>
                </ActivityRow>
            {/each}
        </div>

        <div class="flex items-center justify-between px-1">
            {#if data.page > 1}
                <a href={`/activity?page=${data.page - 1}`} class="text-sm font-medium text-accent">
                    ก่อนหน้า
                </a>
            {:else}
                <span></span>
            {/if}
            {#if data.hasMore}
                <a href={`/activity?page=${data.page + 1}`} class="text-sm font-medium text-accent">
                    เก่ากว่านี้
                </a>
            {/if}
        </div>
    {/if}
</div>
