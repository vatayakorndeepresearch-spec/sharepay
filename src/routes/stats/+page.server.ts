import type { PageServerLoad } from './$types';

type ExpenseRow = {
    amount: number | string;
    category: string | null;
    paid_at: string;
    paid_by: string | null;
    profiles: { display_name: string | null } | null;
};

const RANGE_MONTHS: Record<string, number | null> = {
    '3m': 3,
    '6m': 6,
    '12m': 12,
    all: null
};

function monthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export const load: PageServerLoad = async ({ locals: { supabase }, url }) => {
    const projectId = url.searchParams.get('projectId') || 'all';
    const rangeParam = url.searchParams.get('range') || '6m';
    const range = rangeParam in RANGE_MONTHS ? rangeParam : '6m';
    const rangeMonths = RANGE_MONTHS[range];

    let expensesQuery = supabase
        .from('expenses')
        .select('amount, category, paid_at, paid_by, profiles:paid_by (display_name)')
        .eq('transaction_type', 'expense');

    if (projectId !== 'all') {
        expensesQuery = expensesQuery.eq('project_id', projectId);
    }
    if (rangeMonths !== null) {
        const start = new Date();
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        start.setMonth(start.getMonth() - (rangeMonths - 1));
        expensesQuery = expensesQuery.gte('paid_at', start.toISOString());
    }

    const [
        { data: projects, error: projectsError },
        { data: expenseRows, error: expensesError }
    ] = await Promise.all([
        // Filters list every project (including archived ones) so this dropdown
        // matches the one on the expenses list; only the entry forms hide inactive ones.
        supabase.from('projects').select('id, name').order('name'),
        expensesQuery
    ]);

    if (projectsError) {
        console.error('Error fetching projects:', projectsError);
    }
    if (expensesError) {
        console.error('Error fetching expenses for stats:', expensesError);
    }

    const rows = ((expenseRows as unknown as ExpenseRow[] | null) || []).map((row) => ({
        amount: Number(row.amount || 0),
        category: (row.category || '').trim() || 'ไม่ระบุหมวดหมู่',
        paidAt: new Date(row.paid_at),
        spender: row.profiles?.display_name || 'Unknown'
    }));

    const totalExpense = rows.reduce((sum, row) => sum + row.amount, 0);
    const expenseCount = rows.length;

    // Monthly buckets: continuous from the earliest expense (or range start) to now,
    // so months with no spending show as zero instead of disappearing.
    const now = new Date();
    const bucketStart = new Date(now.getFullYear(), now.getMonth(), 1);
    if (rangeMonths !== null) {
        bucketStart.setMonth(bucketStart.getMonth() - (rangeMonths - 1));
    } else if (rows.length > 0) {
        const earliest = rows.reduce((min, row) => (row.paidAt < min ? row.paidAt : min), rows[0].paidAt);
        bucketStart.setFullYear(earliest.getFullYear(), earliest.getMonth(), 1);
    }

    const monthlyTotals = new Map<string, number>();
    const categoryTotals = new Map<string, number>();
    const spenderTotals = new Map<string, { amount: number; count: number }>();

    for (const row of rows) {
        const key = monthKey(row.paidAt);
        monthlyTotals.set(key, (monthlyTotals.get(key) || 0) + row.amount);
        categoryTotals.set(row.category, (categoryTotals.get(row.category) || 0) + row.amount);
        const spender = spenderTotals.get(row.spender) || { amount: 0, count: 0 };
        spender.amount += row.amount;
        spender.count += 1;
        spenderTotals.set(row.spender, spender);
    }

    const monthlyExpenses: Array<{ month: string; value: number }> = [];
    const cursor = new Date(bucketStart);
    while (cursor <= now) {
        monthlyExpenses.push({
            month: cursor.toLocaleString('th-TH-u-ca-gregory', { month: 'short', year: '2-digit' }),
            value: monthlyTotals.get(monthKey(cursor)) || 0
        });
        cursor.setMonth(cursor.getMonth() + 1);
    }

    const thisMonthExpense = monthlyTotals.get(monthKey(now)) || 0;
    const previousMonthExpense =
        monthlyExpenses.length > 1 ? monthlyExpenses[monthlyExpenses.length - 2].value : 0;

    // Average excludes the current (incomplete) month unless it is the only bucket.
    const completedMonths = monthlyExpenses.slice(0, -1);
    const monthlyAverage =
        completedMonths.length > 0
            ? completedMonths.reduce((sum, entry) => sum + entry.value, 0) / completedMonths.length
            : thisMonthExpense;

    const sortByAmountDesc = <T extends { value: number; label: string }>(a: T, b: T) =>
        b.value - a.value || a.label.localeCompare(b.label, 'th');

    // Colors resolve client-side from --chart-N CSS variables so they follow the theme.
    const categoryBreakdown = [...categoryTotals.entries()]
        .map(([label, value]) => ({ label, value }))
        .sort(sortByAmountDesc)
        .map((entry, index) => ({
            ...entry,
            percent: totalExpense > 0 ? Math.round((entry.value / totalExpense) * 100) : 0,
            colorIndex: index % 7
        }));

    const spenderBreakdown = [...spenderTotals.entries()]
        .map(([label, { amount, count }]) => ({ label, value: amount, count }))
        .sort(sortByAmountDesc)
        .map((entry) => ({
            ...entry,
            percent: totalExpense > 0 ? Math.round((entry.value / totalExpense) * 100) : 0
        }));

    return {
        categoryBreakdown,
        spenderBreakdown,
        monthlyExpenses,
        monthlyAverage,
        previousMonthExpense,
        totalExpense,
        thisMonthExpense,
        expenseCount,
        averagePerExpense: expenseCount > 0 ? totalExpense / expenseCount : 0,
        projects: projects || [],
        selectedProjectId: projectId,
        selectedRange: range
    };
};
