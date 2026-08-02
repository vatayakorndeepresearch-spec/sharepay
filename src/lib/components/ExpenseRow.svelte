<script lang="ts">
    import { ChevronRight, TrendingDown, TrendingUp } from "lucide-svelte";
    import { formatCurrency } from "$lib/utils/formatCurrency";
    import { formatDate } from "$lib/utils/formatDate";
    import { getProfileName, getProjectName } from "$lib/utils/relations";

    type ExpenseLike = {
        id: string;
        amount: number;
        paid_at: string;
        description: string;
        transaction_type: string;
        is_reimbursed: boolean;
        projects?: Parameters<typeof getProjectName>[0];
        profiles?: Parameters<typeof getProfileName>[0];
    };

    export let expense: ExpenseLike;
    export let showDate = true;
    export let showProject = true;
    export let showChevron = false;

    $: isIncome = expense.transaction_type === "income";
</script>

<a
    href={`/expenses/${expense.id}`}
    class="surface-card flex items-center justify-between gap-3 p-3 transition-colors hover:bg-surface-muted"
>
    <div class="flex min-w-0 items-start gap-2.5">
        <div
            class={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                isIncome ? "bg-income-soft text-income-on-soft" : "bg-surface-muted text-soft"
            }`}
        >
            <svelte:component this={isIncome ? TrendingUp : TrendingDown} size={16} />
        </div>

        <div class="min-w-0">
            <div class="truncate text-sm font-medium text-text">{expense.description}</div>
            <div class="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted">
                {#if showDate}
                    <span>{formatDate(expense.paid_at)}</span>
                    <span aria-hidden="true" class="text-border-strong">·</span>
                {/if}
                <span class="truncate">{getProfileName(expense.profiles)}</span>
                {#if showProject}
                    <span aria-hidden="true" class="text-border-strong">·</span>
                    <span class="truncate">{getProjectName(expense.projects)}</span>
                {/if}
            </div>
            {#if !isIncome}
                <div class="mt-1">
                    <span class={`status-chip ${expense.is_reimbursed ? "status-chip-cleared" : "status-chip-pending"}`}>
                        {expense.is_reimbursed ? "เคลียร์แล้ว" : "ค้าง"}
                    </span>
                </div>
            {/if}
        </div>
    </div>

    <div class="shrink-0 text-right">
        <div class={`text-sm font-bold font-display ${isIncome ? "text-income-on-soft" : "text-text"}`}>
            {isIncome ? "+" : ""}{formatCurrency(expense.amount)}
        </div>
        {#if showChevron}
            <ChevronRight size={14} class="ml-auto mt-1 text-border-strong" />
        {/if}
    </div>
</a>
