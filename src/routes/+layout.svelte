<script lang="ts">
  import "../app.css";
  import { page } from "$app/stores";
  import { Home, Plus, List, Settings, PieChart } from "lucide-svelte";
  import { fade, fly } from "svelte/transition";
</script>

<div class="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24">
  <!-- Main Content Container -->
  <main class="max-w-md mx-auto px-4 pt-4 pb-12">
    {#key $page.url.pathname}
      <div in:fade={{ duration: 200, delay: 200 }} out:fade={{ duration: 200 }}>
        <slot />
      </div>
    {/key}
  </main>

  <!-- Bottom Navigation -->
  <nav
    class="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-200 px-6 pt-3 pb-safe z-50 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]"
  >
    <div class="max-w-md mx-auto flex justify-between items-end">
      <a
        href="/"
        class="flex flex-col items-center gap-1.5 py-1 transition-all duration-300 {$page
          .url.pathname === '/'
          ? 'text-indigo-600'
          : 'text-slate-400 hover:text-slate-600'}"
      >
        <div class="relative">
          <Home size={24} strokeWidth={$page.url.pathname === "/" ? 2.5 : 2} />
          {#if $page.url.pathname === "/"}
            <div
              class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-600 rounded-full"
              in:fade
            ></div>
          {/if}
        </div>
        <span class="text-[10px] font-bold uppercase tracking-tight"
          >หน้าแรก</span
        >
      </a>

      <a
        href="/stats"
        class="flex flex-col items-center gap-1.5 py-1 transition-all duration-300 {$page
          .url.pathname === '/stats'
          ? 'text-indigo-600'
          : 'text-slate-400 hover:text-slate-600'}"
      >
        <div class="relative">
          <PieChart
            size={24}
            strokeWidth={$page.url.pathname === "/stats" ? 2.5 : 2}
          />
          {#if $page.url.pathname === "/stats"}
            <div
              class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-600 rounded-full"
              in:fade
            ></div>
          {/if}
        </div>
        <span class="text-[10px] font-bold uppercase tracking-tight">สถิติ</span
        >
      </a>

      <div class="relative -mt-8 flex flex-col items-center">
        <a
          href="/expenses/new"
          class="bg-indigo-600 text-white p-4 rounded-[22px] shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 hover:scale-110 active:scale-90 transition-all duration-300 z-10"
        >
          <Plus size={32} strokeWidth={3} />
        </a>
        <span
          class="text-[10px] font-bold text-slate-500 mt-2 uppercase tracking-tight"
          >จดรายการ</span
        >
      </div>

      <a
        href="/expenses"
        class="flex flex-col items-center gap-1.5 py-1 transition-all duration-300 {$page
          .url.pathname === '/expenses'
          ? 'text-indigo-600'
          : 'text-slate-400 hover:text-slate-600'}"
      >
        <div class="relative">
          <List
            size={24}
            strokeWidth={$page.url.pathname === "/expenses" ? 2.5 : 2}
          />
          {#if $page.url.pathname === "/expenses"}
            <div
              class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-600 rounded-full"
              in:fade
            ></div>
          {/if}
        </div>
        <span class="text-[10px] font-bold uppercase tracking-tight"
          >รายการ</span
        >
      </a>

      <a
        href="/settings"
        class="flex flex-col items-center gap-1.5 py-1 transition-all duration-300 {$page
          .url.pathname === '/settings'
          ? 'text-indigo-600'
          : 'text-slate-400 hover:text-slate-600'}"
      >
        <div class="relative">
          <Settings
            size={24}
            strokeWidth={$page.url.pathname === "/settings" ? 2.5 : 2}
          />
          {#if $page.url.pathname === "/settings"}
            <div
              class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-600 rounded-full"
              in:fade
            ></div>
          {/if}
        </div>
        <span class="text-[10px] font-bold uppercase tracking-tight"
          >ตั้งค่า</span
        >
      </a>
    </div>
  </nav>
</div>

<style>
  .pb-safe {
    padding-bottom: env(safe-area-inset-bottom, 24px);
  }

  :global(.font-outfit) {
    font-family: "Outfit", sans-serif;
  }
</style>
