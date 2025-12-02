import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase }, url }) => {
    const projectId = url.searchParams.get('projectId');

    // Fetch active projects for filter
    const { data: projects } = await supabase
        .from('projects')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

    // Build query
    let query = supabase
        .from('expenses')
        .select(`
            amount,
            category,
            paid_at,
            paid_by (display_name)
        `)
        .order('paid_at', { ascending: true });

    // Apply filter if selected
    if (projectId && projectId !== 'all') {
        query = query.eq('project_id', projectId);
    }

    const { data: expenses, error } = await query;

    if (error) {
        console.error('Error fetching expenses:', error);
        return {
            categoryData: { labels: [], datasets: [] },
            monthlyData: { labels: [], datasets: [] },
            topSpender: null,
            totalExpense: 0,
            projects: [],
            selectedProjectId: 'all'
        };
    }

    // 1. Aggregate by Category
    const categoryMap = new Map<string, number>();
    expenses.forEach(e => {
        const current = categoryMap.get(e.category) || 0;
        categoryMap.set(e.category, current + Number(e.amount));
    });

    const categoryLabels = Array.from(categoryMap.keys());
    const categoryValues = Array.from(categoryMap.values());

    // 2. Aggregate by Month (Last 6 months)
    const monthlyMap = new Map<string, number>();
    expenses.forEach(e => {
        const date = new Date(e.paid_at);
        const monthYear = date.toLocaleString('th-TH', { month: 'short', year: '2-digit' });
        const current = monthlyMap.get(monthYear) || 0;
        monthlyMap.set(monthYear, current + Number(e.amount));
    });

    const monthlyLabels = Array.from(monthlyMap.keys());
    const monthlyValues = Array.from(monthlyMap.values());

    // 3. Top Spender
    const spenderMap = new Map<string, number>();
    expenses.forEach(e => {
        const name = e.paid_by?.display_name || 'Unknown';
        const current = spenderMap.get(name) || 0;
        spenderMap.set(name, current + Number(e.amount));
    });

    let topSpender = { name: '-', amount: 0 };
    spenderMap.forEach((amount, name) => {
        if (amount > topSpender.amount) {
            topSpender = { name, amount };
        }
    });

    const totalExpense = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

    return {
        categoryData: {
            labels: categoryLabels,
            datasets: [{
                data: categoryValues,
                backgroundColor: [
                    '#4f46e5', '#ec4899', '#10b981', '#f59e0b', '#6366f1', '#8b5cf6'
                ]
            }]
        },
        monthlyData: {
            labels: monthlyLabels,
            datasets: [{
                label: 'รายจ่ายรายเดือน',
                data: monthlyValues,
                backgroundColor: '#4f46e5',
                borderRadius: 4
            }]
        },
        topSpender,
        totalExpense,
        projects: projects || [],
        selectedProjectId: projectId || 'all'
    };
};
