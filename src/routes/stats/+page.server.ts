import type { PageServerLoad } from './$types';

type StatsSummaryRow = {
    category_labels: string[] | null;
    category_values: Array<number | string> | null;
    monthly_months: string[] | null;
    monthly_values: Array<number | string> | null;
    top_spender_name: string | null;
    top_spender_amount: number | string | null;
    top_category_name: string | null;
    top_category_amount: number | string | null;
    total_expense: number | string | null;
    this_month_expense: number | string | null;
};

export const load: PageServerLoad = async ({ locals: { supabase }, url }) => {
    const projectId = url.searchParams.get('projectId') || 'all';
    const scopedProjectId = projectId === 'all' ? null : projectId;

    const [
        { data: projects, error: projectsError },
        { data: statsRows, error: statsError }
    ] = await Promise.all([
        // Filters list every project (including archived ones) so this dropdown
        // matches the one on the expenses list; only the entry forms hide inactive ones.
        supabase.from('projects').select('id, name').order('name'),
        supabase.rpc('get_stats_summary', {
            p_project_id: scopedProjectId
        })
    ]);

    if (projectsError) {
        console.error('Error fetching projects:', projectsError);
    }
    if (statsError) {
        console.error('Error fetching stats summary:', statsError);
    }

    if (statsError) {
        return {
            categoryBreakdown: [],
            monthlyExpenses: [],
            previousMonthExpense: 0,
            topSpender: { name: '-', amount: 0 },
            topCategory: { name: '-', amount: 0 },
            totalExpense: 0,
            thisMonthExpense: 0,
            projects: projects || [],
            selectedProjectId: projectId
        };
    }

    const stats = ((statsRows as StatsSummaryRow[] | null)?.[0]) || {
        category_labels: [],
        category_values: [],
        monthly_months: [],
        monthly_values: [],
        top_spender_name: '-',
        top_spender_amount: 0,
        top_category_name: '-',
        top_category_amount: 0,
        total_expense: 0,
        this_month_expense: 0
    };
    const monthlyExpenses = (stats.monthly_months || []).map((month, index) => ({
        month: new Date(`${month}T00:00:00`).toLocaleString('th-TH-u-ca-gregory', {
            month: 'short',
            year: '2-digit'
        }),
        value: Number(stats.monthly_values?.[index] || 0)
    }));
    const categoryLabels = stats.category_labels || [];
    const categoryValues = (stats.category_values || []).map((value) => Number(value || 0));
    const categoryTotal = categoryValues.reduce((sum, value) => sum + value, 0);

    // The RPC returns months oldest-first; the last two are "this month" and "last month".
    const previousMonthExpense =
        monthlyExpenses.length > 1 ? monthlyExpenses[monthlyExpenses.length - 2].value : 0;

    return {
        // Colors resolve client-side from --chart-N CSS variables so they follow the theme.
        categoryBreakdown: categoryLabels.map((label, index) => ({
            label,
            value: categoryValues[index] ?? 0,
            percent: categoryTotal > 0 ? Math.round(((categoryValues[index] ?? 0) / categoryTotal) * 100) : 0,
            colorIndex: index % 7
        })),
        monthlyExpenses,
        previousMonthExpense,
        topSpender: {
            name: stats.top_spender_name || '-',
            amount: Number(stats.top_spender_amount || 0)
        },
        topCategory: {
            name: stats.top_category_name || '-',
            amount: Number(stats.top_category_amount || 0)
        },
        totalExpense: Number(stats.total_expense || 0),
        thisMonthExpense: Number(stats.this_month_expense || 0),
        projects: projects || [],
        selectedProjectId: projectId
    };
};
