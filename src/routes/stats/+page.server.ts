import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase }, url }) => {
    const projectId = url.searchParams.get('projectId') || 'all';

    const { data: projects } = await supabase
        .from('projects')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

    let query = supabase
        .from('expenses')
        .select(`
            amount,
            category,
            paid_at,
            transaction_type,
            paid_by (display_name)
        `)
        .order('paid_at', { ascending: true });

    if (projectId !== 'all') {
        query = query.eq('project_id', projectId);
    }

    const { data: records, error } = await query;

    if (error) {
        console.error('Error fetching expenses:', error);
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

    const expenses = (records || []).filter((record) => record.transaction_type === 'expense');
    const now = new Date();

    const categoryMap = new Map<string, number>();
    const monthlyMap = new Map<string, number>();
    const spenderMap = new Map<string, number>();

    let totalExpense = 0;
    let thisMonthExpense = 0;

    expenses.forEach((record) => {
        const amount = Number(record.amount);
        totalExpense += amount;

        const date = new Date(record.paid_at);
        if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) {
            thisMonthExpense += amount;
        }

        const category = record.category || 'ไม่ระบุหมวดหมู่';
        categoryMap.set(category, (categoryMap.get(category) || 0) + amount);

        const monthYear = date.toLocaleString('th-TH', { month: 'short', year: '2-digit' });
        monthlyMap.set(monthYear, (monthlyMap.get(monthYear) || 0) + amount);

        const paidBy = Array.isArray(record.paid_by) ? record.paid_by[0] : record.paid_by;
        const name = paidBy?.display_name || 'Unknown';
        spenderMap.set(name, (spenderMap.get(name) || 0) + amount);
    });

    const sortedCategories = Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1]);
    const topCategory = sortedCategories[0]
        ? { name: sortedCategories[0][0], amount: sortedCategories[0][1] }
        : { name: '-', amount: 0 };

    const topSpenderEntry = Array.from(spenderMap.entries()).sort((a, b) => b[1] - a[1])[0];
    const topSpender = topSpenderEntry
        ? { name: topSpenderEntry[0], amount: topSpenderEntry[1] }
        : { name: '-', amount: 0 };

    return {
        categoryData: {
            labels: sortedCategories.map(([label]) => label),
            datasets: [{
                data: sortedCategories.map(([, value]) => value),
                backgroundColor: ['#4f46e5', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#0f172a']
            }]
        },
        monthlyData: {
            labels: Array.from(monthlyMap.keys()),
            datasets: [{
                label: 'รายจ่ายรายเดือน',
                data: Array.from(monthlyMap.values()),
                backgroundColor: '#4f46e5',
                borderRadius: 8
            }]
        },
        topSpender,
        topCategory,
        totalExpense,
        thisMonthExpense,
        projects: projects || [],
        selectedProjectId: projectId
    };
};
