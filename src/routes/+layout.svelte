<script lang="ts">
  import "../app.css";
  import { page } from "$app/stores";
  import {
    Home,
    Plus,
    List,
    Settings,
    PieChart,
    Receipt,
    ScanLine,
    X,
  } from "lucide-svelte";
  import { fade, fly, scale } from "svelte/transition";

  let showEntrySheet = false;

  function isActive(pathname: string, href: string) {
    return pathname === href || (href !== "/" && pathname.startsWith(href));
  }
</script>

<div class="app-shell pb-28">
  <main class="max-w-md mx-auto px-4 pt-4 pb-12">
    {#key $page.url.pathname}
      <div in:fade={{ duration: 180 }} out:fade={{ duration: 120 }}>
        <slot />
      </div>
    {/key}
  </main>

  {#if showEntrySheet}
    <button
      type="button"
      class="fixed inset-0 z-[60] bg-slate-950/35 backdrop-blur-sm"
      aria-label="Close entry sheet"
      on:click={() => (showEntrySheet = false)}
      in:fade
      out:fade
    ></button>

    <div class="sheet-panel max-w-md mx-auto" in:fly={{ y: 24, duration: 180 }} out:fly={{ y: 24, duration: 140 }}>
      <div class="mb-4 flex items-center justify-between">
        <div>
          <p class="eyebrow">เริ่มจาก action ที่เร็วที่สุด</p>
          <h2 class="text-xl font-black text-slate-900 font-display">บันทึกรายการ</h2>
        </div>
        <button
          type="button"
          class="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-500"
          aria-label="Close entry sheet"
          on:click={() => (showEntrySheet = false)}
        >
          <X size={18} />
        </button>
      </div>

      <div class="grid gap-3">
        <a
          href="/expenses/new"
          class="surface-card flex items-center gap-4 p-4"
          on:click={() => (showEntrySheet = false)}
        >
          <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <Receipt size={22} />
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-base font-bold text-slate-900">บันทึกรายการเดียว</div>
            <p class="text-sm text-slate-500">กรอกเร็วสำหรับรายการทั่วไปหรือแนบสลิปทีหลัง</p>
          </div>
        </a>

        <a
          href="/expenses/bulk"
          class="surface-card flex items-center gap-4 p-4"
          on:click={() => (showEntrySheet = false)}
        >
          <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <ScanLine size={22} />
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-base font-bold text-slate-900">สแกนหลายสลิป</div>
            <p class="text-sm text-slate-500">อัปโหลดหลายใบแล้วค่อย review ทีละรายการก่อนบันทึก</p>
          </div>
        </a>
      </div>
    </div>
  {/if}

  <nav class="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/90 px-6 pt-3 shadow-[0_-14px_36px_rgba(15,23,42,0.08)] backdrop-blur-xl">
    <div class="max-w-md mx-auto flex justify-between items-end">
      <a
        href="/"
        class={`flex flex-col items-center gap-1.5 py-1 transition-colors ${
          isActive($page.url.pathname, "/") ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
        }`}
      >
        <div class="relative">
          <Home size={22} strokeWidth={isActive($page.url.pathname, "/") ? 2.5 : 2} />
          {#if isActive($page.url.pathname, "/")}
            <div class="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-indigo-600" in:scale></div>
          {/if}
        </div>
        <span class="text-[11px] font-semibold">ภาพรวม</span>
      </a>

      <a
        href="/expenses"
        class={`flex flex-col items-center gap-1.5 py-1 transition-colors ${
          isActive($page.url.pathname, "/expenses") ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
        }`}
      >
        <div class="relative">
          <List size={22} strokeWidth={isActive($page.url.pathname, "/expenses") ? 2.5 : 2} />
          {#if isActive($page.url.pathname, "/expenses")}
            <div class="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-indigo-600" in:scale></div>
          {/if}
        </div>
        <span class="text-[11px] font-semibold">รายการ</span>
      </a>

      <div class="relative -mt-9 flex flex-col items-center">
        <button
          type="button"
          class="z-10 rounded-[24px] bg-indigo-600 p-4 text-white shadow-[0_16px_32px_rgba(79,70,229,0.28)] transition-all hover:bg-indigo-700 hover:scale-105 active:scale-95"
          aria-label="Create new entry"
          on:click={() => (showEntrySheet = !showEntrySheet)}
        >
          <Plus size={30} strokeWidth={3} />
        </button>
        <span class="mt-2 text-[11px] font-semibold text-slate-500">บันทึก</span>
      </div>

      <a
        href="/stats"
        class={`flex flex-col items-center gap-1.5 py-1 transition-colors ${
          isActive($page.url.pathname, "/stats") ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
        }`}
      >
        <div class="relative">
          <PieChart size={22} strokeWidth={isActive($page.url.pathname, "/stats") ? 2.5 : 2} />
          {#if isActive($page.url.pathname, "/stats")}
            <div class="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-indigo-600" in:scale></div>
          {/if}
        </div>
        <span class="text-[11px] font-semibold">อินไซต์</span>
      </a>

      <a
        href="/settings"
        class={`flex flex-col items-center gap-1.5 py-1 transition-colors ${
          isActive($page.url.pathname, "/settings") ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
        }`}
      >
        <div class="relative">
          <Settings size={22} strokeWidth={isActive($page.url.pathname, "/settings") ? 2.5 : 2} />
          {#if isActive($page.url.pathname, "/settings")}
            <div class="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-indigo-600" in:scale></div>
          {/if}
        </div>
        <span class="text-[11px] font-semibold">ตั้งค่า</span>
      </a>
    </div>
    <div class="pb-safe"></div>
  </nav>
</div>

<style>
  .pb-safe {
    padding-bottom: env(safe-area-inset-bottom, 16px);
  }
</style>
