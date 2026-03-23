<script lang="ts">
  import "../app.css";
  import { page } from "$app/stores";
  import { onDestroy } from "svelte";
  import { terminateOCRWorker } from "$lib/stores/ocrStore";
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
  import { fade, fly } from "svelte/transition";

  let showEntrySheet = false;

  function isActive(pathname: string, href: string) {
    return pathname === href || (href !== "/" && pathname.startsWith(href));
  }

  onDestroy(() => {
    terminateOCRWorker();
  });
</script>

<div class="app-shell pb-20">
  <main class="max-w-md mx-auto px-4 pt-4 pb-8">
    {#key $page.url.pathname}
      <div class="page-transition" in:fade={{ duration: 150, delay: 80 }} out:fade={{ duration: 80 }}>
        <slot />
      </div>
    {/key}
  </main>

  {#if showEntrySheet}
    <button
      type="button"
      class="fixed inset-0 z-[60] bg-black/30"
      aria-label="Close entry sheet"
      on:click={() => (showEntrySheet = false)}
      in:fade={{ duration: 150 }}
      out:fade={{ duration: 100 }}
    ></button>

    <div class="sheet-panel max-w-md mx-auto" in:fly={{ y: 20, duration: 150 }} out:fly={{ y: 20, duration: 100 }}>
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-lg font-bold text-slate-900">บันทึกรายการ</h2>
        <button
          type="button"
          class="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
          aria-label="Close entry sheet"
          on:click={() => (showEntrySheet = false)}
        >
          <X size={18} />
        </button>
      </div>

      <div class="grid gap-2">
        <a
          href="/expenses/new"
          class="flex items-center gap-3 rounded-xl p-3 hover:bg-slate-50 transition-colors"
          on:click={() => (showEntrySheet = false)}
        >
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Receipt size={20} />
          </div>
          <div>
            <div class="text-sm font-semibold text-slate-900">บันทึกรายการเดียว</div>
            <p class="text-xs text-slate-500">กรอกเร็ว หรือแนบสลิปให้ OCR อ่าน</p>
          </div>
        </a>

        <a
          href="/expenses/bulk"
          class="flex items-center gap-3 rounded-xl p-3 hover:bg-slate-50 transition-colors"
          on:click={() => (showEntrySheet = false)}
        >
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <ScanLine size={20} />
          </div>
          <div>
            <div class="text-sm font-semibold text-slate-900">สแกนหลายสลิป</div>
            <p class="text-xs text-slate-500">อัปโหลดหลายใบแล้ว review ก่อนบันทึก</p>
          </div>
        </a>
      </div>
    </div>
  {/if}

  <nav class="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur-sm px-4 pt-2">
    <div class="max-w-md mx-auto flex justify-between items-end">
      <a
        href="/"
        class={`flex flex-col items-center gap-1 py-1.5 px-3 transition-colors ${
          isActive($page.url.pathname, "/") ? "text-indigo-600" : "text-slate-400"
        }`}
      >
        <Home size={20} strokeWidth={isActive($page.url.pathname, "/") ? 2.5 : 2} />
        <span class="text-[10px] font-medium">ภาพรวม</span>
      </a>

      <a
        href="/expenses"
        class={`flex flex-col items-center gap-1 py-1.5 px-3 transition-colors ${
          isActive($page.url.pathname, "/expenses") ? "text-indigo-600" : "text-slate-400"
        }`}
      >
        <List size={20} strokeWidth={isActive($page.url.pathname, "/expenses") ? 2.5 : 2} />
        <span class="text-[10px] font-medium">รายการ</span>
      </a>

      <div class="relative -mt-6 flex flex-col items-center">
        <button
          type="button"
          class="z-10 rounded-full bg-indigo-600 p-3 text-white shadow-md transition-all active:scale-95 hover:bg-indigo-700"
          aria-label="Create new entry"
          on:click={() => (showEntrySheet = !showEntrySheet)}
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
        <span class="mt-1.5 text-[10px] font-medium text-slate-400">บันทึก</span>
      </div>

      <a
        href="/stats"
        class={`flex flex-col items-center gap-1 py-1.5 px-3 transition-colors ${
          isActive($page.url.pathname, "/stats") ? "text-indigo-600" : "text-slate-400"
        }`}
      >
        <PieChart size={20} strokeWidth={isActive($page.url.pathname, "/stats") ? 2.5 : 2} />
        <span class="text-[10px] font-medium">อินไซต์</span>
      </a>

      <a
        href="/settings"
        class={`flex flex-col items-center gap-1 py-1.5 px-3 transition-colors ${
          isActive($page.url.pathname, "/settings") ? "text-indigo-600" : "text-slate-400"
        }`}
      >
        <Settings size={20} strokeWidth={isActive($page.url.pathname, "/settings") ? 2.5 : 2} />
        <span class="text-[10px] font-medium">ตั้งค่า</span>
      </a>
    </div>
    <div class="pb-safe"></div>
  </nav>
</div>

<style>
  .pb-safe {
    padding-bottom: env(safe-area-inset-bottom, 12px);
  }
</style>
