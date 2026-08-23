<script lang="ts">
    import { CheckCircle2, Pencil, Plus, RotateCcw, Trash2 } from "lucide-svelte";
    import { formatCurrency } from "$lib/utils/formatCurrency";
    import { formatRelativeTime } from "$lib/utils/formatDate";

    type Activity = {
        id: string;
        expense_id: string | null;
        action: "create" | "update" | "reimburse" | "unreimburse" | "delete";
        actor_name: string | null;
        snapshot: {
            description?: string | null;
            amount?: number | null;
            transaction_type?: string | null;
            project_name?: string | null;
        } | null;
        undone_at: string | null;
        created_at: string;
    };

    export let activity: Activity;

    const meta = {
        create: { icon: Plus, label: "เพิ่มรายการ", tone: "bg-surface-muted text-soft" },
        update: { icon: Pencil, label: "แก้ไขรายการ", tone: "bg-surface-muted text-soft" },
        reimburse: { icon: CheckCircle2, label: "เคลียร์ยอด", tone: "bg-income-soft text-income-on-soft" },
        unreimburse: { icon: RotateCcw, label: "ยกเลิกการเคลียร์", tone: "bg-surface-muted text-soft" },
        delete: { icon: Trash2, label: "ลบรายการ", tone: "bg-surface-muted text-muted" },
    } as const;

    $: entry = meta[activity.action] ?? meta.update;
    $: snapshot = activity.snapshot ?? {};
    $: title = snapshot.description || "รายการที่ถูกลบ";
    $: href = activity.expense_id ? `/expenses/${activity.expense_id}` : null;
</script>

<div class="flex items-center gap-3 p-3">
    <div class={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${entry.tone}`}>
        <svelte:component this={entry.icon} size={16} />
    </div>

    <!-- The link wraps only the text block so an undo button can sit beside it. -->
    <svelte:element
        this={href ? "a" : "div"}
        href={href ?? undefined}
        class={`min-w-0 flex-1 rounded-lg ${href ? "transition-opacity hover:opacity-70" : ""}`}
    >
        <div class="flex items-center gap-1.5">
            <span class="text-sm font-semibold text-text">{entry.label}</span>
            {#if activity.undone_at}
                <span class="rounded-md bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-muted">
                    ย้อนกลับแล้ว
                </span>
            {/if}
        </div>
        <p class="truncate text-xs text-muted">
            {title}{snapshot.project_name ? ` · ${snapshot.project_name}` : ""}
        </p>
        <p class="text-xs text-soft">
            {formatRelativeTime(activity.created_at)}{activity.actor_name ? ` · ${activity.actor_name}` : ""}
        </p>
    </svelte:element>

    <div class="flex shrink-0 flex-col items-end gap-1.5">
        {#if snapshot.amount}
            <span
                class={`money text-sm ${
                    snapshot.transaction_type === "income" ? "text-income-on-soft" : "text-text"
                }`}
            >
                {formatCurrency(snapshot.amount)}
            </span>
        {/if}
        <slot name="undo" />
    </div>
</div>
