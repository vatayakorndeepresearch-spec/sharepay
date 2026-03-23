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
        supabase
            .from('projects')
            .select('id, name')
            .eq('is_active', true)
            .order('name'),
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
            categoryData: { labels: [], datasets: [] },
            monthlyData: { labels: [], datasets: [] },
            topSpender: { name: '-', amount: 0 },
            topCategory: { name: '-', amount: 0 },
            totalExpense: 0,
            thisMonthExpense: 0,
            projects: [],
            selectedProjectId: 'all'
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
    const monthlyLabels = (stats.monthly_months || []).map((month) =>
        new Date(`${month}T00:00:00`).toLocaleString('th-TH', { month: 'short', year: '2-digit' })
    );

    return {
        categoryData: {
            labels: stats.category_labels || [],
            datasets: [{
                data: (stats.category_values || []).map((value) => Number(value || 0)),
                backgroundColor: ['#4f46e5', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#0f172a']
            }]
        },
        monthlyData: {
            labels: monthlyLabels,
            datasets: [{
                label: 'รายจ่ายรายเดือน',
                data: (stats.monthly_values || []).map((value) => Number(value || 0)),
                backgroundColor: '#4f46e5',
                borderRadius: 8
            }]
        },
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
