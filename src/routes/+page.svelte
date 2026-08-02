<script lang="ts">
    import { countUp } from "$lib/actions/countUp";
    import { formatCurrency } from "$lib/utils/formatCurrency";
    import EmptyState from "$lib/components/EmptyState.svelte";
    import ExpenseRow from "$lib/components/ExpenseRow.svelte";
    import {
        ArrowRight,
        Briefcase,
        CheckCircle2,
        Clock3,
        Link as LinkIcon,
        Receipt,
        TrendingDown,
        TrendingUp,
    } from "lucide-svelte";

    export let data;

    $: settlement = data.settlementSummary;
    $: projectCards = Object.entries(data.projectSummary || {}).map(([id, project]) => ({
        id,
        ...project,
    }));
    $: totals = projectCards.reduce(
        (sum, project) => ({
            income: sum.income + project.income,
            expense: sum.expense + project.expense,
        }),
        { income: 0, expense: 0 }
    );

    // One card, four states — never claim "all clear" when we simply don't know yet.
    // Backgrounds come from .surface-card--hero[data-state] in app.css.
    const heroIcon = {
        you_owe: Clock3,
        owed_to_you: ArrowRight,
        clear: CheckCircle2,
        unknown: LinkIcon,
    } as const;

    $: heroState = (settlement.state in heroIcon ? settlement.state : "unknown") as keyof typeof heroIcon;
    $: heroMuted = heroState === "unknown" ? "text-muted" : "text-white/70";
    $: heroChip = heroState === "unknown" ? "bg-surface" : "bg-white/15";
</script>

<div class="page-shell enter">
    <header class="px-1">
        <p class="text-sm text-muted">ยินดีต้อนรับกลับ</p>
        <h1 class="page-title">
            {data.currentUser?.name ? data.currentUser.name.split(" ")[0] : "SharePay"}
        </h1>
    </header>

    <section class="surface-card surface-card--hero p-5" data-state={heroState}>
        <div class="relative">
            <div class={`mb-3 flex items-center gap-1.5 text-xs font-medium ${heroMuted}`}>
                <svelte:component this={heroIcon[heroState]} size={12} />
                สถานะตอนนี้
            </div>

            <h2 class="text-lg font-bold font-display">{settlement.headline}</h2>

            {#if settlement.amount > 0}
                <div class={`mt-3 rounded-xl px-4 py-3 ${heroChip}`}>
                    <p class={`text-xs ${heroMuted}`}>ยอดที่ต้องจัดการ</p>
                    <div class="money money-lg mt-0.5" use:countUp={{ value: settlement.amount }}>
                        {formatCurrency(settlement.amount)}
                    </div>
                    {#if settlement.unpaidCount > 0}
                        <p class={`mt-1 text-xs ${heroMuted}`}>
                            จาก {settlement.unpaidCount} รายการที่ยังไม่เคลียร์
                        </p>
                    {/if}
                </div>
            {:else}
                <p class={`mt-1 text-sm ${heroMuted}`}>{settlement.subline}</p>
            {/if}

            <a
                href={settlement.ctaHref}
                class={`mt-4 inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                    heroState === "unknown"
                        ? "bg-accent text-white hover:bg-accent-hover"
                        : "bg-white text-accent-on-soft hover:bg-white/90"
                }`}
            >
                {settlement.ctaLabel}
                <ArrowRight size={14} />
            </a>
        </div>
    </section>

    {#if totals.income > 0 || totals.expense > 0}
        <section class="grid grid-cols-2 gap-2">
            <div class="surface-card surface-card--flat p-4">
                <div class="kpi-label flex items-center gap-1.5">
                    <TrendingUp size={12} class="text-income" />
                    รายรับรวม
                </div>
                <div class="money money-md mt-1 truncate text-income-on-soft">
                    {formatCurrency(totals.income)}
                </div>
            </div>
            <div class="surface-card surface-card--flat p-4">
                <div class="kpi-label flex items-center gap-1.5">
                    <TrendingDown size={12} class="text-muted" />
                    รายจ่ายรวม
                </div>
                <div class="money money-md mt-1 truncate text-text">
                    {formatCurrency(totals.expense)}
                </div>
            </div>
        </section>
    {/if}

    <section class="space-y-2">
        <h2 class="px-1 text-base font-bold text-text">ภาพรวมโปรเจค</h2>

        {#if projectCards.length === 0}
            <EmptyState
                icon={Briefcase}
                title="ยังไม่มีโปรเจค"
                description="สร้างโปรเจคเพื่อแยกยอดรายรับรายจ่ายเป็นกอง ๆ"
            />
        {:else}
            <div class="grid gap-2">
                {#each projectCards as project (project.id)}
                    {@const total = project.income + project.expense}
                    <a
                        href={`/expenses?project=${project.id}`}
                        class="surface-card block p-4 transition-colors hover:bg-surface-muted"
                    >
                        <div class="mb-3 flex items-center justify-between">
                            <div class="flex min-w-0 items-center gap-2.5">
                                <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-soft">
                                    <Briefcase size={16} />
                                </div>
                                <span class="truncate text-sm font-semibold text-text">{project.name}</span>
                            </div>
                            <ArrowRight size={14} class="shrink-0 text-border-strong" />
                        </div>

                        <div class="grid grid-cols-2 gap-2">
                            <div class="rounded-lg bg-income-soft px-3 py-2">
                                <div class="flex items-center gap-1.5 text-xs font-medium text-income-on-soft">
                                    <TrendingUp size={13} />
                                    รายรับ
                                </div>
                                <div class="mt-0.5 text-base font-bold text-income-on-soft font-display">
                                    {formatCurrency(project.income)}
                                </div>
                            </div>
                            <div class="rounded-lg bg-surface-muted px-3 py-2">
                                <div class="flex items-center gap-1.5 text-xs font-medium text-muted">
                                    <TrendingDown size={13} />
                                    รายจ่าย
                                </div>
                                <div class="mt-0.5 text-base font-bold text-text font-display">
                                    {formatCurrency(project.expense)}
                                </div>
                            </div>
                        </div>

                        {#if total > 0}
                            <div class="mt-3 flex h-1.5 overflow-hidden rounded-full bg-surface-muted">
                                <div class="bg-income" style={`width: ${(project.income / total) * 100}%`}></div>
                                <div class="bg-border-strong" style={`width: ${(project.expense / total) * 100}%`}></div>
                            </div>
                        {/if}
                    </a>
                {/each}
            </div>
        {/if}
    </section>

    <section class="space-y-2">
        <div class="flex items-center justify-between px-1">
            <h2 class="text-base font-bold text-text">รายการล่าสุด</h2>
            <a href="/expenses" class="text-sm font-medium text-accent">ดูทั้งหมด</a>
        </div>

        {#if data.expenses.length === 0}
            <EmptyState
                icon={Receipt}
                title="ยังไม่มีรายการ"
                description="เริ่มบันทึกรายการแรกเพื่อให้ภาพรวมมีข้อมูล"
                actionLabel="บันทึกรายการใหม่"
                actionHref="/expenses/new"
            />
        {:else}
            <div class="surface-card divide-y divide-border overflow-hidden">
                {#each data.expenses as expense (expense.id)}
                    <ExpenseRow {expense} flat />
                {/each}
            </div>
        {/if}
    </section>
</div>
