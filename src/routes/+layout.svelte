<script lang="ts">
  import "../app.css";
  import { page } from "$app/stores";
  import { Home, PlusCircle, List, Settings } from "lucide-svelte";
</script>

<div class="min-h-screen bg-gray-50 text-gray-900 font-sans pb-20">
  <!-- Main Content -->
  <main class="max-w-md mx-auto px-4 py-6">
    <slot />
  </main>

  <!-- Bottom Navigation -->
  <nav
    class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 z-50 safe-area-bottom"
  >
    <div class="max-w-md mx-auto flex justify-between items-center">
      <a
        href="/"
        class="flex flex-col items-center gap-1 py-1 transition {$page.url
          .pathname === '/'
          ? 'text-indigo-600'
          : 'text-gray-400 hover:text-gray-600'}"
      >
        <Home size={28} />
        <span class="text-xs font-medium">หน้าแรก</span>
      </a>

      <a
        href="/expenses/new"
        class="flex flex-col items-center gap-1 transition text-indigo-600 -mt-10"
      >
        <div
          class="bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 hover:scale-105 transition"
        >
          <PlusCircle size={36} />
        </div>
        <span class="text-xs font-medium">จดรายการ</span>
      </a>

      <a
        href="/expenses"
        class="flex flex-col items-center gap-1 py-1 transition {$page.url
          .pathname === '/expenses'
          ? 'text-indigo-600'
          : 'text-gray-400 hover:text-gray-600'}"
      >
        <List size={28} />
        <span class="text-xs font-medium">รายการ</span>
      </a>
    </div>
  </nav>
</div>

<style>
  /* Support for iPhone X+ safe area */
  .safe-area-bottom {
    padding-bottom: env(safe-area-inset-bottom, 20px);
  }
</style>
