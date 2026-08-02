import type { PageServerLoad } from './$types';

type StatsPayload = {
    total: number | string;
    count: number;
    earliest: string | null;
    monthly: Array<{ month: string; value: number | string }>;
    by_category: Array<{ label: string; value: number | string }>;
    by_spender: Array<{ label: string; value: number | string; count: number }>;
};

const EMPTY_STATS: StatsPayload = {
    total: 0,
    count: 0,
    earliest: null,
    monthly: [],
    by_category: [],
    by_spender: []
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

    let rangeStart: Date | null = null;
    if (rangeMonths !== null) {
        rangeStart = new Date();
        rangeStart.setDate(1);
        rangeStart.setHours(0, 0, 0, 0);
        rangeStart.setMonth(rangeStart.getMonth() - (rangeMonths - 1));
    }

    const [
        { data: projects, error: projectsError },
        { data: statsData, error: statsError }
    ] = await Promise.all([
        // Filters list every project (including archived ones) so this dropdown
        // matches the one on the expenses list; only the entry forms hide inactive ones.
        supabase.from('projects').select('id, name').order('name'),
        // Aggregation runs in Postgres so the payload stays flat no matter how many
        // expenses exist. See supabase/migrations/20260802_stats_aggregate.sql.
        supabase.rpc('get_expense_stats', {
            p_project_id: projectId === 'all' ? null : projectId,
            p_start: rangeStart ? rangeStart.toISOString() : null
        })
    ]);

    if (projectsError) {
        console.error('Error fetching projects:', projectsError);
    }
    if (statsError) {
        console.error('Error fetching expense stats:', statsError);
    }

    const stats = (statsData as StatsPayload | null) ?? EMPTY_STATS;

    const totalExpense = Number(stats.total || 0);
    const expenseCount = Number(stats.count || 0);
    const monthlyTotals = new Map(stats.monthly.map((entry) => [entry.month, Number(entry.value || 0)]));

    // Monthly buckets: continuous from the earliest expense (or range start) to now,
    // so months with no spending show as zero instead of disappearing.
    const now = new Date();
    const bucketStart = new Date(now.getFullYear(), now.getMonth(), 1);
    if (rangeMonths !== null) {
        bucketStart.setMonth(bucketStart.getMonth() - (rangeMonths - 1));
    } else if (stats.earliest) {
        const earliest = new Date(stats.earliest);
        bucketStart.setFullYear(earliest.getFullYear(), earliest.getMonth(), 1);
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
    const categoryBreakdown = stats.by_category
        .map((entry) => ({ label: entry.label, value: Number(entry.value || 0) }))
        .sort(sortByAmountDesc)
        .map((entry, index) => ({
            ...entry,
            percent: totalExpense > 0 ? Math.round((entry.value / totalExpense) * 100) : 0,
            colorIndex: index % 7
        }));

    const spenderBreakdown = stats.by_spender
        .map((entry) => ({ label: entry.label, value: Number(entry.value || 0), count: entry.count }))
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
