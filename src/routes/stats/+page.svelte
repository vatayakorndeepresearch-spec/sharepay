<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import Chart from "chart.js/auto";
    import { formatCurrency } from "$lib/utils/formatCurrency";
    import {
        PieChart as PieChartIcon,
        TrendingUp,
        Award,
        DollarSign,
        Filter,
        ChartBar,
        ChevronLeft,
        Target,
        Sparkles,
    } from "lucide-svelte";
    import { fade, slide, fly, scale } from "svelte/transition";

    export let data;

    let pieCanvas: HTMLCanvasElement;
    let barCanvas: HTMLCanvasElement;
    let pieChart: Chart;
    let barChart: Chart;

    function handleProjectChange(event: Event) {
        const select = event.target as HTMLSelectElement;
        const projectId = select.value;
        goto(`?projectId=${projectId}`);
    }

    $: if (pieCanvas && data.categoryData) {
        if (pieChart) pieChart.destroy();
        pieChart = new Chart(pieCanvas, {
            type: "doughnut",
            data: data.categoryData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "75%",
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: { family: "Inter", weight: "bold", size: 10 },
                        },
                    },
                },
            },
        });
    }

    $: if (barCanvas && data.monthlyData) {
        if (barChart) barChart.destroy();
        barChart = new Chart(barCanvas, {
            type: "bar",
            data: data.monthlyData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { display: true, color: "rgba(0,0,0,0.03)" },
                        ticks: { font: { family: "Inter", size: 10 } },
                    },
                    x: {
                        grid: { display: false },
                        ticks: {
                            font: { family: "Inter", size: 10, weight: "bold" },
                        },
                    },
                },
                elements: {
                    bar: {
                        borderRadius: 12,
                        backgroundColor: "rgba(79, 70, 229, 0.8)",
                    },
                },
            },
        });
    }
</script>

<div class="space-y-6 pb-24">
    <div class="px-1">
        <h1
            class="text-3xl font-black text-slate-900 font-display tracking-tight flex items-center gap-3"
        >
            <ChartBar class="text-indigo-600" size={32} />
            วิเคราะห์ผล
        </h1>
        <p
            class="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1"
        >
            สรุปข้อมูลการเงินของคุณ
        </p>
    </div>

    <!-- Project Filter -->
    <div
        class="bg-white/70 backdrop-blur-md p-4 rounded-[28px] border border-white shadow-sm premium-shadow flex items-center gap-4"
    >
        <div
            class="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0"
        >
            <Filter size={20} />
        </div>
        <div class="flex-1">
            <label
                class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 px-1"
                >เลือกโปรเจค</label
            >
            <select
                class="block w-full text-sm font-bold bg-transparent border-none focus:ring-0 p-0"
                value={data.selectedProjectId}
                on:change={handleProjectChange}
            >
                <option value="all">ทุกโปรเจค</option>
                {#each data.projects as project}
                    <option value={project.id}>{project.name}</option>
                {/each}
            </select>
        </div>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-2 gap-4">
        <div
            class="bg-indigo-600 rounded-[32px] p-6 text-white shadow-xl shadow-indigo-600/20 relative overflow-hidden group"
        >
            <div
                class="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"
            ></div>
            <div class="relative z-10">
                <div class="flex items-center gap-2 mb-2 opacity-80">
                    <DollarSign size={14} strokeWidth={3} />
                    <span
                        class="text-[10px] font-black uppercase tracking-widest"
                        >ยอดรวมทั้งหมด</span
                    >
                </div>
                <div class="text-2xl font-black font-display tracking-tight">
                    {formatCurrency(data.totalExpense)}
                </div>
            </div>
        </div>

        <div
            class="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm premium-shadow"
        >
            <div class="flex items-center gap-2 mb-2 text-slate-400">
                <Award size={14} strokeWidth={3} class="text-amber-500" />
                <span class="text-[10px] font-black uppercase tracking-widest"
                    >จ่ายเยอะสุด</span
                >
            </div>
            <div
                class="text-xl font-black font-display text-slate-900 truncate tracking-tight"
            >
                {data.topSpender?.name || "-"}
            </div>
            <div class="text-xs font-bold text-slate-400 mt-1">
                {formatCurrency(data.topSpender?.amount || 0)}
            </div>
        </div>
    </div>

    <!-- Charts -->
    <div
        class="bg-white/80 backdrop-blur-md rounded-[32px] p-6 shadow-sm border border-white premium-shadow"
        in:fly={{ y: 20, duration: 600 }}
    >
        <div class="flex items-center justify-between mb-6 px-1">
            <h2
                class="text-sm font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight"
            >
                <PieChartIcon size={16} class="text-indigo-600" /> แบ่งตามหมวดหมู่
            </h2>
            <div
                class="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg uppercase tracking-widest"
            >
                Category
            </div>
        </div>
        <div class="relative h-64">
            <canvas bind:this={pieCanvas}></canvas>
        </div>
    </div>

    <div
        class="bg-white/80 backdrop-blur-md rounded-[32px] p-6 shadow-sm border border-white premium-shadow"
        in:fly={{ y: 20, duration: 600, delay: 100 }}
    >
        <div class="flex items-center justify-between mb-6 px-1">
            <h2
                class="text-sm font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight"
            >
                <TrendingUp size={16} class="text-emerald-500" /> แนวโน้มรายเดือน
            </h2>
            <div
                class="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg uppercase tracking-widest"
            >
                Monthly
            </div>
        </div>
        <div class="relative h-64">
            <canvas bind:this={barCanvas}></canvas>
        </div>
    </div>
</div>
