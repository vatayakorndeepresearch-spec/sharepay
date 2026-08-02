<script lang="ts">
    import { goto } from "$app/navigation";
    import { onDestroy, onMount } from "svelte";
    import { formatCurrency } from "$lib/utils/formatCurrency";
    import EmptyState from "$lib/components/EmptyState.svelte";
    import {
        Award,
        ChartBar,
        Filter,
        PieChart as PieChartIcon,
        TrendingDown,
        TrendingUp,
        Wallet,
    } from "lucide-svelte";

    export let data;

    let pieCanvas: HTMLCanvasElement;
    let barCanvas: HTMLCanvasElement;
    let pieChart: any;
    let barChart: any;
    let renderToken = 0;

    function handleProjectChange(event: Event) {
        const projectId = (event.currentTarget as HTMLSelectElement).value;
        goto(projectId === "all" ? "/stats" : `?projectId=${projectId}`);
    }

    async function renderCharts() {
        const token = ++renderToken;
        const { default: Chart } = await import("chart.js/auto");
        // A newer render started while the chart module was loading — drop this one.
        if (token !== renderToken) return;

        if (pieCanvas && data.categoryData?.labels?.length) {
            pieChart?.destroy();
            pieChart = new Chart(pieCanvas, {
                type: "doughnut",
                data: data.categoryData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: "72%",
                    plugins: { legend: { display: false } },
                },
            });
        }

        if (barCanvas && data.monthlyData?.labels?.length) {
            barChart?.destroy();
            barChart = new Chart(barCanvas, {
                type: "bar",
                data: data.monthlyData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: {
                            beginAtZero: true,
                            border: { display: false },
                            grid: { color: "rgba(148,163,184,0.2)" },
                            ticks: { font: { family: "Inter", size: 10 }, color: "#94a3b8" },
                        },
                        x: {
                            grid: { display: false },
                            ticks: {
                                font: { family: "Inter", size: 10, weight: 600 },
                                color: "#94a3b8",
                            },
                        },
                    },
                },
            });
        }
    }

    // Depend on `data` explicitly — bind:this only fires on mount, so without this the
    // charts keep showing the previous project after switching the filter.
    $: if (data && (pieCanvas || barCanvas)) {
        renderCharts();
    }

    $: monthDelta =
        data.previousMonthExpense > 0
            ? Math.round(
                  ((data.thisMonthExpense - data.previousMonthExpense) / data.previousMonthExpense) * 100
              )
            : null;

    onMount(() => {
        renderCharts();
    });

    onDestroy(() => {
        pieChart?.destroy();
        barChart?.destroy();
    });
</script>

<div class="page-shell">
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

    <section class="surface-card p-4">
        <div class="flex items-center gap-1.5 text-xs font-medium text-muted">
            <Wallet size={13} class="text-accent" />
            เดือนนี้ใช้ไป
        </div>
        <div class="mt-1 text-3xl font-bold text-text font-display">
            {formatCurrency(data.thisMonthExpense)}
        </div>
        {#if monthDelta !== null}
            <div
                class={`mt-1.5 inline-flex items-center gap-1 text-xs font-medium ${
                    monthDelta > 0 ? "text-pending-on-soft" : "text-income-on-soft"
                }`}
            >
                <svelte:component this={monthDelta > 0 ? TrendingUp : TrendingDown} size={13} />
                {monthDelta > 0 ? "+" : ""}{monthDelta}% จากเดือนที่แล้ว ({formatCurrency(data.previousMonthExpense)})
            </div>
        {/if}
        <div class="mt-3 border-t border-border pt-3 text-xs text-muted">
            รวมทั้งหมด <span class="font-semibold text-text">{formatCurrency(data.totalExpense)}</span>
        </div>
    </section>

    <section class="grid grid-cols-2 gap-2">
        <div class="surface-card p-4">
            <div class="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                <Award size={13} class="text-pending" />
                ออกเยอะสุด
            </div>
            <div class="truncate text-base font-bold text-text font-display">{data.topSpender.name || "-"}</div>
            <div class="text-xs text-muted">{formatCurrency(data.topSpender.amount || 0)}</div>
        </div>

        <div class="surface-card p-4">
            <div class="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                <PieChartIcon size={13} class="text-income" />
                หมวดสูงสุด
            </div>
            <div class="truncate text-base font-bold text-text font-display">{data.topCategory.name || "-"}</div>
            <div class="text-xs text-muted">{formatCurrency(data.topCategory.amount || 0)}</div>
        </div>
    </section>

    {#if !data.categoryData.labels.length}
        <EmptyState
            icon={ChartBar}
            title="ยังไม่มีข้อมูลพอ"
            description="เพิ่มรายการรายจ่ายเพื่อดูกราฟและ insight"
            actionLabel="บันทึกรายการใหม่"
            actionHref="/expenses/new"
        />
    {:else}
        <section class="surface-card p-4">
            <h2 class="mb-3 text-sm font-semibold text-text">แบ่งตามหมวดหมู่</h2>
            <div class="relative h-52">
                <canvas bind:this={pieCanvas}></canvas>
            </div>

            <div class="mt-4 space-y-1.5">
                {#each data.categoryBreakdown as item (item.label)}
                    <a
                        href={`/expenses?q=${encodeURIComponent(item.label)}`}
                        class="flex items-center gap-2.5 rounded-lg px-1 py-1.5 transition-colors hover:bg-surface-muted"
                    >
                        <span class="h-2.5 w-2.5 shrink-0 rounded-full" style={`background:${item.color}`}></span>
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
            <h2 class="mb-3 text-sm font-semibold text-text">แนวโน้มรายเดือน</h2>
            <div class="relative h-56">
                <canvas bind:this={barCanvas}></canvas>
            </div>
        </section>
    {/if}
</div>
