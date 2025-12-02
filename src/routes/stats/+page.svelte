<script lang="ts">
    import { onMount } from "svelte";
    import Chart from "chart.js/auto";
    import { formatCurrency } from "$lib/utils/formatCurrency";
    import { PieChart, TrendingUp, Award, DollarSign } from "lucide-svelte";

    export let data;

    let pieCanvas: HTMLCanvasElement;
    let barCanvas: HTMLCanvasElement;

    onMount(() => {
        if (pieCanvas) {
            new Chart(pieCanvas, {
                type: "doughnut",
                data: data.categoryData,
                options: {
                    responsive: true,
                    plugins: {
                        legend: { position: "bottom" },
                    },
                },
            });
        }

        if (barCanvas) {
            new Chart(barCanvas, {
                type: "bar",
                data: data.monthlyData,
                options: {
                    responsive: true,
                    scales: {
                        y: { beginAtZero: true },
                    },
                },
            });
        }
    });
</script>

<div class="space-y-6 pb-20">
    <h1 class="text-2xl font-bold text-gray-800 flex items-center gap-2">
        <PieChart class="text-indigo-600" size={28} />
        ภาพรวมค่าใช้จ่าย
    </h1>

    <!-- Summary Cards -->
    <div class="grid grid-cols-2 gap-4">
        <div
            class="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-4 text-white shadow-lg"
        >
            <div class="flex items-center gap-2 mb-1 opacity-90">
                <DollarSign size={16} />
                <span class="text-xs font-medium">ยอดรวมทั้งหมด</span>
            </div>
            <div class="text-xl font-bold">
                {formatCurrency(data.totalExpense)}
            </div>
        </div>

        <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div class="flex items-center gap-2 mb-1 text-gray-500">
                <Award size={16} class="text-yellow-500" />
                <span class="text-xs font-medium">จ่ายเยอะสุด</span>
            </div>
            <div class="text-lg font-bold text-gray-800 truncate">
                {data.topSpender.name}
            </div>
            <div class="text-xs text-gray-500">
                {formatCurrency(data.topSpender.amount)}
            </div>
        </div>
    </div>

    <!-- Charts -->
    <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2
            class="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"
        >
            <PieChart size={16} /> แบ่งตามหมวดหมู่
        </h2>
        <div class="relative h-64">
            <canvas bind:this={pieCanvas}></canvas>
        </div>
    </div>

    <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2
            class="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"
        >
            <TrendingUp size={16} /> แนวโน้มรายเดือน
        </h2>
        <div class="relative h-64">
            <canvas bind:this={barCanvas}></canvas>
        </div>
    </div>
</div>
