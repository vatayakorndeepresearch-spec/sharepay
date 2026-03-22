<script lang="ts">
    import { goto } from "$app/navigation";
    import Chart from "chart.js/auto";
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
    let pieChart: Chart;
    let barChart: Chart;

    function handleProjectChange(event: Event) {
        const projectId = (event.target as HTMLSelectElement).value;
        goto(projectId === "all" ? "/stats" : `?projectId=${projectId}`);
    }

    $: if (pieCanvas && data.categoryData?.labels?.length) {
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

    $: if (barCanvas && data.monthlyData?.labels?.length) {
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
</script>

<div class="page-shell">
    <header class="px-1">
        <p class="eyebrow">Insight</p>
        <h1 class="flex items-center gap-3 text-3xl font-black text-slate-900 font-display tracking-tight">
            <ChartBar class="text-indigo-600" size={30} />
            ภาพรวมการใช้เงิน
        </h1>
        <p class="mt-1 text-sm text-slate-500">ดูยอดเดือนนี้ ใครออกเงินเยอะกว่า และหมวดที่กินงบมากสุดก่อนดูกราฟ</p>
    </header>

    <section class="surface-card-soft flex items-center gap-4 p-4">
        <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <Filter size={18} />
        </div>
        <div class="flex-1">
            <label class="field-label mb-1" for="stats-project">โปรเจคที่ต้องการดู</label>
            <select
                id="stats-project"
                class="field-input border-none bg-transparent px-0 py-0 focus:ring-0"
                value={data.selectedProjectId}
                on:change={handleProjectChange}
            >
                <option value="all">ทุกโปรเจค</option>
                {#each data.projects as project}
                    <option value={project.id}>{project.name}</option>
                {/each}
            </select>
        </div>
    </section>

    <section class="grid gap-3 md:grid-cols-3">
        <div class="surface-card p-5">
            <div class="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-500">
                <TrendingUp size={15} class="text-indigo-600" />
                เดือนนี้ใช้ไป
            </div>
            <div class="text-2xl font-black text-slate-900 font-display">{formatCurrency(data.thisMonthExpense)}</div>
            <p class="mt-1 text-sm text-slate-500">ยอดรายจ่ายของเดือนปัจจุบัน</p>
        </div>

        <div class="surface-card p-5">
            <div class="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-500">
                <Award size={15} class="text-amber-500" />
                คนที่ออกเยอะสุด
            </div>
            <div class="text-xl font-black text-slate-900 font-display">{data.topSpender.name || "-"}</div>
            <p class="mt-1 text-sm text-slate-500">{formatCurrency(data.topSpender.amount || 0)}</p>
        </div>

        <div class="surface-card p-5">
            <div class="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-500">
                <PieChartIcon size={15} class="text-emerald-600" />
                หมวดที่สูงสุด
            </div>
            <div class="text-xl font-black text-slate-900 font-display">{data.topCategory.name || "-"}</div>
            <p class="mt-1 text-sm text-slate-500">{formatCurrency(data.topCategory.amount || 0)}</p>
        </div>
    </section>

    {#if !data.categoryData.labels.length}
        <section class="surface-card p-8 text-center">
            <div class="text-lg font-black text-slate-900 font-display">ยังไม่มีข้อมูลพอสำหรับ insight</div>
            <p class="mt-2 text-sm text-slate-500">เพิ่มรายการรายจ่ายก่อน แล้วกราฟกับ summary ด้านบนจะเริ่มมีความหมาย</p>
            <a href="/expenses/new" class="mt-5 inline-flex rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white">
                บันทึกรายการใหม่
            </a>
        </section>
    {:else}
        <section class="surface-card p-6">
            <div class="mb-5">
                <h2 class="text-lg font-black text-slate-900 font-display">แบ่งตามหมวดหมู่</h2>
                <p class="text-sm text-slate-500">ดูว่ารายจ่ายส่วนใหญ่ไหลไปที่หมวดไหน</p>
            </div>
            <div class="relative h-72">
                <canvas bind:this={pieCanvas}></canvas>
            </div>
        </section>

        <section class="surface-card p-6">
            <div class="mb-5">
                <h2 class="text-lg font-black text-slate-900 font-display">แนวโน้มรายเดือน</h2>
                <p class="text-sm text-slate-500">เช็กจังหวะรายจ่ายย้อนหลังเพื่อดูว่าช่วงไหนใช้เยอะขึ้น</p>
            </div>
            <div class="relative h-72">
                <canvas bind:this={barCanvas}></canvas>
            </div>
        </section>
    {/if}
</div>
