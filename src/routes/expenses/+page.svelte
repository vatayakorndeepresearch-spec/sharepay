<script lang="ts">
    import { goto } from "$app/navigation";
    import { navigating, page } from "$app/stores";
    import { onDestroy } from "svelte";
    import { formatCurrency } from "$lib/utils/formatCurrency";
    import { formatDateGroup, formatMonth } from "$lib/utils/formatDate";
    import EmptyState from "$lib/components/EmptyState.svelte";
    import ExpenseRow from "$lib/components/ExpenseRow.svelte";
    import ExpenseRowSkeleton from "$lib/components/ExpenseRowSkeleton.svelte";
    import Sheet from "$lib/components/Sheet.svelte";
    import {
        CalendarDays,
        ChevronLeft,
        ChevronRight,
        Download,
        FileSpreadsheet,
        Funnel,
        Loader2,
        Receipt,
        Search,
        SlidersHorizontal,
        X,
    } from "lucide-svelte";

    export let data;

    type ExpenseRecord = (typeof data.expenses)[number];
    type QuickMode = "all" | "unpaid" | "paid" | "income" | "expense";

    let showAdvancedFilters = false;
    let searchValue = data.filters.q;
    let searchTimer: ReturnType<typeof setTimeout> | null = null;

    // Keep the box in sync when the query changes from anywhere else (chips, reset).
    $: if (data.filters.q !== searchValue && !searchTimer) {
        searchValue = data.filters.q;
    }

    function commitSearch(value: string) {
        searchTimer = null;
        updateQuery({ q: value });
    }

    function onSearchInput(event: Event) {
        searchValue = (event.currentTarget as HTMLInputElement).value;
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(() => commitSearch(searchValue), 400);
    }

    function updateQuery(next: Record<string, string>, options: { resetPage?: boolean } = {}) {
        const { resetPage = true } = options;
        const query = new URLSearchParams($page.url.searchParams);

        Object.entries(next).forEach(([key, value]) => {
            if (!value || value === "all") {
                query.delete(key);
            } else {
                query.set(key, value);
            }
        });

        if (resetPage) {
            query.delete("page");
        } else if (query.get("page") === "1") {
            query.delete("page");
        }

        goto(query.size ? `?${query.toString()}` : "/expenses", { keepFocus: true, noScroll: true });
    }

    function applyQuickFilter(mode: QuickMode) {
        if (mode === "all") {
            updateQuery({ status: "all", type: "all" });
        } else if (mode === "unpaid" || mode === "paid") {
            updateQuery({ status: mode, type: "expense" });
        } else {
            updateQuery({ status: "all", type: mode });
        }
    }

    function getQuickMode(filters: typeof data.filters): QuickMode {
        if (filters.status === "unpaid" && filters.type === "expense") return "unpaid";
        if (filters.status === "paid" && filters.type === "expense") return "paid";
        if (filters.type === "income") return "income";
        if (filters.type === "expense" && filters.status === "all") return "expense";
        return "all";
    }

    function groupedExpenses(expenses: ExpenseRecord[]) {
        const groups = new Map<string, ExpenseRecord[]>();
        for (const expense of expenses) {
            if (!groups.has(expense.paid_at)) groups.set(expense.paid_at, []);
            groups.get(expense.paid_at)?.push(expense);
        }

        return Array.from(groups.entries()).map(([date, items]) => ({
            date,
            label: formatDateGroup(date),
            total: items.reduce(
                (sum, item) => sum + (item.transaction_type === "income" ? 0 : Number(item.amount)),
                0
            ),
            items,
        }));
    }

    function buildExportUrl(format: "csv" | "xlsx", filters: typeof data.filters) {
        const params = new URLSearchParams();
        params.set("format", format);
        if (filters.project !== "all") params.set("project", filters.project);
        if (filters.type !== "all") params.set("type", filters.type);
        if (filters.status !== "all") params.set("status", filters.status);
        if (filters.month !== "all") params.set("month", filters.month);
        if (filters.q) params.set("q", filters.q);
        return `/expenses/export?${params.toString()}`;
    }

    const quickFilters: Array<{ mode: QuickMode; label: string; key: keyof typeof data.summaryCounts }> = [
        { mode: "all", label: "ทั้งหมด", key: "all" },
        { mode: "unpaid", label: "ค้าง", key: "unpaid" },
        { mode: "paid", label: "เคลียร์แล้ว", key: "paid" },
        { mode: "income", label: "รายรับ", key: "income" },
        { mode: "expense", label: "รายจ่าย", key: "expense" },
    ];

    // The server now returns one page at a time, so "load more" appends here instead
    // of re-fetching every previously loaded row.
    let loadedExpenses: ExpenseRecord[] = data.expenses;
    let loadedSignature = "";

    function accumulate(page: typeof data) {
        const signature = JSON.stringify(page.filters);
        if (signature !== loadedSignature || page.pagination.page === 1) {
            loadedSignature = signature;
            loadedExpenses = page.expenses;
            return loadedExpenses;
        }

        const seen = new Set(loadedExpenses.map((expense) => expense.id));
        loadedExpenses = [...loadedExpenses, ...page.expenses.filter((expense) => !seen.has(expense.id))];
        return loadedExpenses;
    }

    $: visibleExpenses = accumulate(data);
    $: activeQuickMode = getQuickMode(data.filters);
    $: dateGroups = groupedExpenses(visibleExpenses);
    $: currentMonth = data.filters.month;
    $: monthLabel = formatMonth(currentMonth);
    $: exportCsvUrl = buildExportUrl("csv", data.filters);
    $: exportXlsxUrl = buildExportUrl("xlsx", data.filters);
    $: selectedProjectName =
        data.filters.project === "all"
            ? "ทุกโปรเจค"
            : data.projects.find((project) => project.id === data.filters.project)?.name || "ทุกโปรเจค";

    type FilterChip = { key: string; label: string; clear: Record<string, string> };

    // Chips that show — and let the user undo — every filter that is not the default.
    function buildActiveChips(filters: typeof data.filters, projectName: string, month: string) {
        const chips: FilterChip[] = [];
        if (filters.q) chips.push({ key: "q", label: `ค้นหา: ${filters.q}`, clear: { q: "" } });
        if (filters.project !== "all") {
            chips.push({ key: "project", label: `โปรเจค: ${projectName}`, clear: { project: "all" } });
        }
        if (filters.month !== "all") {
            chips.push({ key: "month", label: month, clear: { month: "all" } });
        }
        return chips;
    }

    $: activeFilterChips = buildActiveChips(data.filters, selectedProjectName, monthLabel);

    // Paging keeps the list on screen; changing a filter swaps it for a skeleton.
    $: isLoadingMore =
        Boolean($navigating) && Number($navigating?.to?.url.searchParams.get("page") || "1") > 1;
    $: isLoading = Boolean($navigating) && !isLoadingMore;

    function goMonth(direction: -1 | 1) {
        const [y, m] = currentMonth.split("-").map(Number);
        let year = y;
        let month = m + direction;
        if (month === 0) {
            year -= 1;
            month = 12;
        }
        if (month === 13) {
            year += 1;
            month = 1;
        }
        updateQuery({ month: `${year}-${String(month).padStart(2, "0")}` });
    }

    function goCurrentMonth() {
        const now = new Date();
        updateQuery({ month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}` });
    }

    onDestroy(() => {
        if (searchTimer) clearTimeout(searchTimer);
    });
</script>

<div class="page-shell">
    <div class="sticky-header bleed-gutter space-y-3 bg-bg/95 pb-3 pt-1 backdrop-blur">
        <header class="flex items-center justify-between">
            <h1 class="page-title">รายการทั้งหมด</h1>
            <button
                type="button"
                class="icon-button"
                aria-label="ตัวกรองเพิ่มเติม"
                aria-expanded={showAdvancedFilters}
                on:click={() => (showAdvancedFilters = true)}
            >
                <SlidersHorizontal size={16} />
            </button>
        </header>

        <div class="relative">
            <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
                <Search size={15} />
            </span>
            <input
                type="search"
                placeholder="ค้นหารายละเอียด หมายเหตุ หรือหมวดหมู่"
                class="field-input pl-9"
                value={searchValue}
                on:input={onSearchInput}
            />
        </div>

        <section class="surface-card flex items-center justify-between p-1.5">
            {#if currentMonth === "all"}
                <button type="button" class="btn-secondary flex-1 py-2 text-sm" on:click={goCurrentMonth}>
                    <CalendarDays size={15} />
                    เลือกเดือน
                </button>
            {:else}
                <button
                    type="button"
                    class="flex h-10 w-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-muted"
                    aria-label="เดือนก่อนหน้า"
                    on:click={() => goMonth(-1)}
                >
                    <ChevronLeft size={18} />
                </button>
                <button
                    type="button"
                    class="rounded-lg px-3 py-2 text-sm font-semibold text-text transition-colors hover:bg-surface-muted"
                    on:click={() => updateQuery({ month: "all" })}
                >
                    {monthLabel}
                </button>
                <button
                    type="button"
                    class="flex h-10 w-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-muted"
                    aria-label="เดือนถัดไป"
                    on:click={() => goMonth(1)}
                >
                    <ChevronRight size={18} />
                </button>
            {/if}
        </section>

        <div class="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5">
            {#each quickFilters as filter}
                <button
                    type="button"
                    class={`filter-chip shrink-0 ${activeQuickMode === filter.mode ? "filter-chip-active" : ""}`}
                    aria-pressed={activeQuickMode === filter.mode}
                    on:click={() => applyQuickFilter(filter.mode)}
                >
                    {filter.label}
                    <span class="filter-chip-count">{data.summaryCounts[filter.key]}</span>
                </button>
            {/each}
        </div>

        {#if activeFilterChips.length > 0}
            <div class="flex flex-wrap gap-1.5">
                {#each activeFilterChips as chip (chip.key)}
                    <button
                        type="button"
                        class="inline-flex items-center gap-1.5 rounded-lg bg-accent-soft px-2.5 py-1.5 text-xs font-medium text-accent-on-soft"
                        on:click={() => updateQuery(chip.clear)}
                    >
                        <span class="max-w-[16ch] truncate">{chip.label}</span>
                        <X size={12} />
                    </button>
                {/each}
            </div>
        {/if}
    </div>

    <section class="surface-card flex items-center justify-between p-4">
        <div class="text-sm text-soft">
            <span class="font-semibold text-text">{data.summaryTotals.filteredCount}</span> รายการ
        </div>
        <div class="text-base font-bold text-text font-display">
            {formatCurrency(data.summaryTotals.filteredAmount)}
        </div>
    </section>

    {#if isLoading}
        <ExpenseRowSkeleton rows={5} />
    {:else if visibleExpenses.length === 0}
        <EmptyState
            icon={Receipt}
            title="ไม่พบรายการ"
            description="ลองเปลี่ยนตัวกรอง หรือบันทึกรายการใหม่"
            actionLabel="บันทึกรายการใหม่"
            actionHref="/expenses/new"
        />
    {:else}
        <section class="space-y-4">
            {#each dateGroups as group (group.date)}
                <div class="space-y-2">
                    <div class="flex items-baseline justify-between px-1">
                        <div class="text-xs font-semibold text-muted">{group.label}</div>
                        {#if group.total > 0}
                            <div class="text-xs font-medium text-muted">{formatCurrency(group.total)}</div>
                        {/if}
                    </div>

                    <div class="grid gap-2">
                        {#each group.items as expense (expense.id)}
                            <ExpenseRow {expense} showDate={false} showChevron />
                        {/each}
                    </div>
                </div>
            {/each}

            {#if data.pagination.hasMore}
                <button
                    type="button"
                    disabled={isLoadingMore}
                    class="surface-card flex w-full items-center justify-center gap-2 p-3 text-sm font-semibold text-accent transition-colors hover:bg-surface-muted disabled:opacity-60"
                    on:click={() => updateQuery({ page: String(data.pagination.page + 1) }, { resetPage: false })}
                >
                    {#if isLoadingMore}
                        <Loader2 size={15} class="animate-spin" />
                        กำลังโหลด...
                    {:else}
                        โหลดเพิ่ม · แสดงแล้ว {visibleExpenses.length} จาก {data.summaryTotals.filteredCount} รายการ
                    {/if}
                </button>
            {/if}
        </section>
    {/if}
</div>

<Sheet open={showAdvancedFilters} title="กรองรายการ" on:close={() => (showAdvancedFilters = false)}>
    <div class="space-y-3">
        <div>
            <label class="field-label" for="project-filter">โปรเจค</label>
            <select
                id="project-filter"
                class="field-input"
                data-autofocus
                value={data.filters.project}
                on:change={(event) => updateQuery({ project: event.currentTarget.value })}
            >
                <option value="all">ทุกโปรเจค</option>
                {#each data.projects as project (project.id)}
                    <option value={project.id}>{project.name}</option>
                {/each}
            </select>
        </div>

        <div>
            <label class="field-label" for="type-filter">ประเภท</label>
            <select
                id="type-filter"
                class="field-input"
                value={data.filters.type}
                on:change={(event) => updateQuery({ type: event.currentTarget.value })}
            >
                <option value="all">ทั้งหมด</option>
                <option value="expense">รายจ่าย</option>
                <option value="income">รายรับ</option>
            </select>
        </div>

        <div>
            <label class="field-label" for="status-filter">สถานะ</label>
            <select
                id="status-filter"
                class="field-input"
                value={data.filters.status}
                on:change={(event) => updateQuery({ status: event.currentTarget.value })}
            >
                <option value="all">ทั้งหมด</option>
                <option value="unpaid">ยังไม่เคลียร์</option>
                <option value="paid">เคลียร์แล้ว</option>
            </select>
        </div>

        {#if visibleExpenses.length > 0}
            <div>
                <div class="field-label">ดาวน์โหลดตามตัวกรองนี้</div>
                <div class="grid grid-cols-2 gap-2">
                    <a href={exportCsvUrl} download class="btn-secondary text-sm">
                        <Download size={14} />
                        CSV
                    </a>
                    <a href={exportXlsxUrl} download class="btn-secondary text-sm">
                        <FileSpreadsheet size={14} />
                        Excel
                    </a>
                </div>
            </div>
        {/if}

        <button
            type="button"
            class="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-danger-on-soft"
            on:click={() => {
                showAdvancedFilters = false;
                searchValue = "";
                goto("/expenses");
            }}
        >
            <Funnel size={14} />
            ล้างตัวกรองทั้งหมด
        </button>
    </div>
</Sheet>
