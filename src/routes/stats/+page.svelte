<script lang="ts">
    import { goto } from "$app/navigation";
    import { onMount, onDestroy } from "svelte";
    import { formatCurrency } from "$lib/utils/formatCurrency";
    import {
        Award,
        ChartBar,
        Filter,
        PieChart as PieChartIcon,
        TrendingUp,
    } from "lucide-svelte";

    export let data;

    let pieCanvas: HTMLCanvasElement;
    let barCanvas: HTMLCanvasElement;
    let pieChart: any;
    let barChart: any;

    function handleProjectChange(event: Event) {
        const projectId = (event.target as HTMLSelectElement).value;
        goto(projectId === "all" ? "/stats" : `?projectId=${projectId}`);
    }

    async function renderCharts() {
        const { default: Chart } = await import("chart.js/auto");

        if (pieCanvas && data.categoryData?.labels?.length) {
            if (pieChart) pieChart.destroy();
            pieChart = new Chart(pieCanvas, {
                type: "doughnut",
                data: data.categoryData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: "72%",
                    plugins: {
                        legend: {
                            position: "bottom",
                            labels: {
                                usePointStyle: true,
                                boxWidth: 8,
                                padding: 16,
                                font: { family: "Inter", weight: 600, size: 11 },
                            },
                        },
                    },
                },
            });
        }

        if (barCanvas && data.monthlyData?.labels?.length) {
            if (barChart) barChart.destroy();
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
                            grid: { color: "rgba(148,163,184,0.15)" },
                            ticks: { font: { family: "Inter", size: 10 } },
                        },
                        x: {
                            grid: { display: false },
                            ticks: { font: { family: "Inter", size: 10, weight: 600 } },
                        },
                    },
                },
            });
        }
    }

    onMount(() => {
        renderCharts();
    });

    onDestroy(() => {
        if (pieChart) pieChart.destroy();
        if (barChart) barChart.destroy();
    });

    $: if (pieCanvas || barCanvas) {
        renderCharts();
    }
</script>

<div class="page-shell">
    <header class="px-1">
        <h1 class="text-2xl font-bold text-slate-900 font-display flex items-center gap-2">
            <ChartBar class="text-indigo-600" size={24} />
            อินไซต์
        </h1>
    </header>

    <section class="surface-card flex items-center gap-3 p-3">
        <Filter size={16} class="text-slate-400" />
        <select
            id="stats-project"
            class="flex-1 border-none bg-transparent text-sm font-medium text-slate-900 focus:ring-0 p-0"
            value={data.selectedProjectId}
            on:change={handleProjectChange}
        >
            <option value="all">ทุกโปรเจค</option>
            {#each data.projects as project}
                <option value={project.id}>{project.name}</option>
            {/each}
        </select>
    </section>

    <section class="grid gap-2 md:grid-cols-3">
        <div class="surface-card p-4">
            <div class="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1">
                <TrendingUp size={13} class="text-indigo-600" />
                เดือนนี้ใช้ไป
            </div>
            <div class="text-xl font-bold text-slate-900 font-display">{formatCurrency(data.thisMonthExpense)}</div>
        </div>

        <div class="surface-card p-4">
            <div class="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1">
                <Award size={13} class="text-amber-500" />
                ออกเยอะสุด
            </div>
            <div class="text-base font-bold text-slate-900 font-display">{data.topSpender.name || "-"}</div>
            <div class="text-xs text-slate-500">{formatCurrency(data.topSpender.amount || 0)}</div>
        </div>

        <div class="surface-card p-4">
            <div class="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1">
                <PieChartIcon size={13} class="text-emerald-600" />
                หมวดสูงสุด
            </div>
            <div class="text-base font-bold text-slate-900 font-display">{data.topCategory.name || "-"}</div>
            <div class="text-xs text-slate-500">{formatCurrency(data.topCategory.amount || 0)}</div>
        </div>
    </section>

    {#if !data.categoryData.labels.length}
        <section class="surface-card p-6 text-center">
            <div class="text-base font-bold text-slate-900">ยังไม่มีข้อมูลพอ</div>
            <p class="mt-1 text-sm text-slate-500">เพิ่มรายการรายจ่ายเพื่อดูกราฟและ insight</p>
            <a href="/expenses/new" class="mt-3 inline-flex rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white">
                บันทึกรายการใหม่
            </a>
        </section>
    {:else}
        <section class="surface-card p-4">
            <h2 class="text-sm font-semibold text-slate-900 mb-3">แบ่งตามหมวดหมู่</h2>
            <div class="relative h-64">
                <canvas bind:this={pieCanvas}></canvas>
            </div>
        </section>

        <section class="surface-card p-4">
            <h2 class="text-sm font-semibold text-slate-900 mb-3">แนวโน้มรายเดือน</h2>
            <div class="relative h-64">
                <canvas bind:this={barCanvas}></canvas>
            </div>
        </section>
    {/if}
</div>
