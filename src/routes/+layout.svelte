<script lang="ts">
  import "../app.css";
  import { page } from "$app/stores";
  import { Home, List, PieChart, Plus, Receipt, ScanLine, Settings } from "lucide-svelte";
  import Sheet from "$lib/components/Sheet.svelte";
  import Toaster from "$lib/components/Toaster.svelte";

  let showEntrySheet = false;

  const tabs = [
    { href: "/", label: "ภาพรวม", icon: Home },
    { href: "/expenses", label: "รายการ", icon: List },
    { href: "/stats", label: "อินไซต์", icon: PieChart },
    { href: "/settings", label: "ตั้งค่า", icon: Settings },
  ];

  function isActive(pathname: string, href: string) {
    return pathname === href || (href !== "/" && pathname.startsWith(href));
  }

  $: onAuthScreen =
    $page.url.pathname.startsWith("/login") || $page.url.pathname.startsWith("/auth");
</script>

<div class="app-shell">
  <main class="mx-auto max-w-md px-4 pt-4">
    <slot />
  </main>

  {#if !onAuthScreen}
    <Sheet open={showEntrySheet} title="บันทึกรายการ" on:close={() => (showEntrySheet = false)}>
      <div class="grid gap-1">
        <a
          href="/expenses/new"
          class="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-surface-muted"
          data-autofocus
          on:click={() => (showEntrySheet = false)}
        >
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent-on-soft">
            <Receipt size={20} />
          </div>
          <div>
            <div class="text-sm font-semibold text-text">บันทึกรายการเดียว</div>
            <p class="text-xs text-muted">กรอกเร็ว หรือแนบสลิปให้ OCR อ่าน</p>
          </div>
        </a>

        <a
          href="/expenses/bulk"
          class="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-surface-muted"
          on:click={() => (showEntrySheet = false)}
        >
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-income-soft text-income-on-soft">
            <ScanLine size={20} />
          </div>
          <div>
            <div class="text-sm font-semibold text-text">สแกนหลายสลิป</div>
            <p class="text-xs text-muted">อัปโหลดหลายใบแล้ว review ก่อนบันทึก</p>
          </div>
        </a>
      </div>
    </Sheet>

    <Toaster />

    <nav
      class="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface/95 backdrop-blur-sm"
      style="padding-bottom: var(--safe-bottom)"
      aria-label="เมนูหลัก"
    >
      <div class="mx-auto flex h-nav max-w-md items-center justify-between px-2">
        {#each tabs.slice(0, 2) as tab}
          {@const active = isActive($page.url.pathname, tab.href)}
          <a
            href={tab.href}
            aria-current={active ? "page" : undefined}
            class={`flex h-full w-16 flex-col items-center justify-center gap-1 rounded-xl transition-colors ${
              active ? "text-accent" : "text-muted"
            }`}
          >
            <svelte:component this={tab.icon} size={20} strokeWidth={active ? 2.5 : 2} />
            <span class="text-[10px] font-medium">{tab.label}</span>
          </a>
        {/each}

        <button
          type="button"
          class="-mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/25 transition-all hover:bg-accent-hover active:scale-95"
          aria-label="บันทึกรายการใหม่"
          aria-expanded={showEntrySheet}
          on:click={() => (showEntrySheet = !showEntrySheet)}
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>

        {#each tabs.slice(2) as tab}
          {@const active = isActive($page.url.pathname, tab.href)}
          <a
            href={tab.href}
            aria-current={active ? "page" : undefined}
            class={`flex h-full w-16 flex-col items-center justify-center gap-1 rounded-xl transition-colors ${
              active ? "text-accent" : "text-muted"
            }`}
          >
            <svelte:component this={tab.icon} size={20} strokeWidth={active ? 2.5 : 2} />
            <span class="text-[10px] font-medium">{tab.label}</span>
          </a>
        {/each}
      </div>
    </nav>
  {/if}
</div>
