<script lang="ts">
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import { countUp } from "$lib/actions/countUp";
    import { formatCurrency } from "$lib/utils/formatCurrency";
    import EmptyState from "$lib/components/EmptyState.svelte";
    import {
        ChartBar,
        Filter,
        Hash,
        Receipt,
        TrendingDown,
        TrendingUp,
        Users,
        Wallet,
    } from "lucide-svelte";

    export let data;

    // layerchart is ~500 KB — keep it out of the page bundle and off the preload path.
    let charts: { PieChart: any; BarChart: any } | null = null;
    onMount(async () => {
        const m = await import("layerchart");
        charts = { PieChart: m.PieChart, BarChart: m.BarChart };
    });

    // Fixed slot order — colors follow the category, resolved per-theme in app.css.
    const CHART_COLORS = [1, 2, 3, 4, 5, 6, 7].map((n) => `var(--chart-${n})`);

    const RANGES = [
        { value: "3m", label: "3 เดือน" },
        { value: "6m", label: "6 เดือน" },
        { value: "12m", label: "1 ปี" },
        { value: "all", label: "ทั้งหมด" },
    ];

    function buildUrl(projectId: string, range: string) {
        const params = new URLSearchParams();
        if (projectId !== "all") params.set("projectId", projectId);
        if (range !== "6m") params.set("range", range);
        const query = params.toString();
        return query ? `/stats?${query}` : "/stats";
    }

    function handleProjectChange(event: Event) {
        const projectId = (event.currentTarget as HTMLSelectElement).value;
        goto(buildUrl(projectId, data.selectedRange));
    }

    // Split into two series so the current (last) month renders in accent
    // while past months stay muted — layerchart colors per series, not per bar.
    $: monthlyChartData = data.monthlyExpenses.map((entry, index) => ({
        ...entry,
        past: index < data.monthlyExpenses.length - 1 ? entry.value : null,
        current: index === data.monthlyExpenses.length - 1 ? entry.value : null,
    }));

    $: monthDelta =
        data.previousMonthExpense > 0
            ? Math.round(
                  ((data.thisMonthExpense - data.previousMonthExpense) / data.previousMonthExpense) * 100
              )
            : null;
</script>

<div class="page-shell enter">
    <header>
        <h1 class="page-title flex items-center gap-2">
            <ChartBar class="text-accent" size={24} />
            อินไซต์
        </h1>
    </header>

    <section class="surface-card flex items-center gap-3 p-3">
        <Filter size={16} class="shrink-0 text-muted" />
        <label class="sr-only" for="stats-project">เลือกโปรเจค</label>
        <select
            id="stats-project"
            class="flex-1 border-none bg-transparent p-0 text-sm font-medium text-text focus:ring-0"
            value={data.selectedProjectId}
            on:change={handleProjectChange}
        >
            <option value="all">ทุกโปรเจค</option>
            {#each data.projects as project (project.id)}
                <option value={project.id}>{project.name}</option>
            {/each}
        </select>
    </section>

    <div class="flex gap-1.5" role="group" aria-label="ช่วงเวลา">
        {#each RANGES as range (range.value)}
            <a
                href={buildUrl(data.selectedProjectId, range.value)}
                class={`flex-1 rounded-full px-2 py-1.5 text-center text-xs font-semibold transition-colors ${
                    data.selectedRange === range.value
                        ? "bg-accent text-white"
                        : "bg-surface-muted text-muted hover:text-soft"
                }`}
                aria-current={data.selectedRange === range.value ? "true" : undefined}
            >
                {range.label}
            </a>
        {/each}
    </div>

    <section class="grid grid-cols-2 gap-2">
        <div class="surface-card surface-card--raised col-span-2 p-5">
            <div class="kpi-label flex items-center gap-1.5">
                <Wallet size={12} class="text-accent" />
                ใช้จ่ายเดือนนี้
            </div>
            <div class="mt-1 flex flex-wrap items-baseline gap-2">
                <div
                    class="money money-lg truncate text-text"
                    use:countUp={{ value: data.thisMonthExpense }}
                >
                    {formatCurrency(data.thisMonthExpense)}
                </div>
                {#if monthDelta !== null}
                    <span
                        class={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                            monthDelta > 0
                                ? "bg-pending-soft text-pending-on-soft"
                                : "bg-income-soft text-income-on-soft"
                        }`}
                    >
                        <svelte:component this={monthDelta > 0 ? TrendingUp : TrendingDown} size={11} />
                        {monthDelta > 0 ? "+" : ""}{monthDelta}%
                    </span>
                {/if}
            </div>
            <div class="mt-1 text-[11px] text-muted">
                {monthDelta !== null
                    ? `เทียบเดือนก่อน (${formatCurrency(data.previousMonthExpense)})`
                    : "ยังไม่มีเดือนก่อนเทียบ"}
            </div>
        </div>

        <div class="surface-card surface-card--flat p-4">
            <div class="kpi-label flex items-center gap-1.5">
                <ChartBar size={12} class="text-income" />
                เฉลี่ย/เดือน
            </div>
            <div class="money money-md mt-1 truncate text-text">
                {formatCurrency(data.monthlyAverage)}
            </div>
            <div class="mt-0.5 text-[11px] text-muted">ไม่รวมเดือนปัจจุบัน</div>
        </div>

        <div class="surface-card surface-card--flat p-4">
            <div class="kpi-label flex items-center gap-1.5">
                <Receipt size={12} class="text-accent" />
                เฉลี่ย/รายการ
            </div>
            <div class="money money-md mt-1 truncate text-text">
                {formatCurrency(data.averagePerExpense)}
            </div>
            <div class="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
                <Hash size={10} />
                {data.expenseCount} รายการ · รวม {formatCurrency(data.totalExpense)}
            </div>
        </div>
    </section>

    {#if !data.categoryBreakdown.length}
        <EmptyState
            icon={ChartBar}
            title="ยังไม่มีข้อมูลพอ"
            description="เพิ่มรายการรายจ่ายเพื่อดูกราฟและ insight"
            actionLabel="บันทึกรายการใหม่"
            actionHref="/expenses/new"
        />
    {:else}
        <section class="surface-card p-4">
            <div class="mb-3 flex items-baseline justify-between">
                <h2 class="text-sm font-semibold text-text">แนวโน้มรายเดือน</h2>
                <span class="text-[11px] text-muted">เฉลี่ย {formatCurrency(data.monthlyAverage)}/เดือน</span>
            </div>
            <div class="relative h-56">
                {#if charts}
                <svelte:component
                    this={charts.BarChart}
                    data={monthlyChartData}
                    x="month"
                    y="value"
                    bandPadding={0.3}
                    series={[
                        {
                            key: "past",
                            label: "รายจ่าย",
                            color: "rgb(var(--border-strong))",
                            props: { radius: 4, rounded: "top", strokeWidth: 0 },
                        },
                        {
                            key: "current",
                            label: "เดือนนี้",
                            color: "rgb(var(--accent))",
                            props: { radius: 4, rounded: "top", strokeWidth: 0 },
                        },
                    ]}
                    annotations={[
                        {
                            type: "line",
                            y: data.monthlyAverage,
                            label: "เฉลี่ย",
                            labelPlacement: "top-right",
                            props: {
                                line: { class: "stroke-[var(--chart-2)] [stroke-dasharray:4_3]" },
                                label: { class: "text-[9px] fill-muted" },
                            },
                        },
                    ]}
                    props={{
                        xAxis: { tickLabelProps: { class: "text-[10px] fill-muted font-medium" } },
                        yAxis: { tickLabelProps: { class: "text-[10px] fill-muted" } },
                        grid: { class: "stroke-[var(--chart-grid)]" },
                    }}
                />
                {:else}
                    <div class="h-56 animate-pulse rounded-xl bg-surface-muted"></div>
                {/if}
            </div>
        </section>

        <section class="surface-card p-4">
            <h2 class="mb-3 text-sm font-semibold text-text">แบ่งตามหมวดหมู่</h2>
            <div class="relative h-52">
                {#if charts}
                    <svelte:component
                        this={charts.PieChart}
                        data={data.categoryBreakdown}
                        key="label"
                        value="value"
                        cRange={CHART_COLORS}
                        innerRadius={-24}
                        cornerRadius={4}
                        padAngle={0.02}
                    />
                {:else}
                    <div class="mx-auto h-52 w-52 animate-pulse rounded-full bg-surface-muted"></div>
                {/if}
            </div>

            <div class="mt-4 space-y-1.5">
                {#each data.categoryBreakdown as item (item.label)}
                    <a
                        href={`/expenses?q=${encodeURIComponent(item.label)}`}
                        class="flex items-center gap-2.5 rounded-lg px-1 py-1.5 transition-colors hover:bg-surface-muted"
                    >
                        <span
                            class="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={`background:var(--chart-${item.colorIndex + 1})`}
                        ></span>
                        <span class="min-w-0 flex-1 truncate text-sm text-soft">{item.label}</span>
                        <span class="shrink-0 text-xs text-muted">{item.percent}%</span>
                        <span class="w-24 shrink-0 text-right text-sm font-semibold text-text">
                            {formatCurrency(item.value)}
                        </span>
                    </a>
                {/each}
            </div>
        </section>

        <section class="surface-card p-4">
            <h2 class="mb-3 flex items-center gap-1.5 text-sm font-semibold text-text">
                <Users size={15} class="text-accent" />
                ใครออกเงินเท่าไหร่
            </h2>
            <div class="space-y-3">
                {#each data.spenderBreakdown as spender, spenderIndex (spender.label)}
                    <div>
                        <div class="mb-1 flex items-baseline justify-between gap-2">
                            <span class="min-w-0 flex-1 truncate text-sm font-medium text-soft">
                                {spender.label}
                            </span>
                            <span class="shrink-0 text-xs text-muted">{spender.count} รายการ</span>
                            <span class="shrink-0 text-sm font-semibold text-text">
                                {formatCurrency(spender.value)}
                            </span>
                        </div>
                        <div class="flex items-center gap-2">
                            <div class="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
                                <div
                                    class="bar-h h-full rounded-full bg-accent"
                                    style={`width:${Math.max(spender.percent, 2)}%;animation-delay:${300 + spenderIndex * 50}ms`}
                                ></div>
                            </div>
                            <span class="w-9 shrink-0 text-right text-xs font-medium text-muted">
                                {spender.percent}%
                            </span>
                        </div>
                    </div>
                {/each}
            </div>
        </section>
    {/if}
</div>
