import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals: { supabase } }) => {
    const projectId = url.searchParams.get('project') || 'all';
    const status = url.searchParams.get('status') || 'all';
    const type = url.searchParams.get('type') || 'all';

    const { data: projects } = await supabase.from('projects').select('*').order('name');

    let query = supabase
        .from('expenses')
        .select(`
            *,
            projects (name),
            profiles!expenses_paid_by_fkey (display_name)
        `)
        .order('paid_at', { ascending: false });

    if (projectId !== 'all') {
        query = query.eq('project_id', projectId);
    }

    const { data: projectScopedExpenses } = await query;
    const expenses = (projectScopedExpenses || []).filter((expense) => {
        const matchesType = type === 'all' || expense.transaction_type === type;
        const matchesStatus =
            status === 'all' ||
            (status === 'unpaid' && !expense.is_reimbursed) ||
            (status === 'paid' && expense.is_reimbursed);

        return matchesType && matchesStatus;
    });

    const summaryCounts = {
        all: projectScopedExpenses?.length || 0,
        unpaid: projectScopedExpenses?.filter((expense) => expense.transaction_type === 'expense' && !expense.is_reimbursed).length || 0,
        paid: projectScopedExpenses?.filter((expense) => expense.transaction_type === 'expense' && expense.is_reimbursed).length || 0,
        income: projectScopedExpenses?.filter((expense) => expense.transaction_type === 'income').length || 0,
        expense: projectScopedExpenses?.filter((expense) => expense.transaction_type === 'expense').length || 0
    };

    const summaryTotals = {
        filteredCount: expenses.length,
        filteredAmount: expenses.reduce((sum, expense) => sum + Number(expense.amount), 0)
    };

    return {
        expenses,
        projects: projects || [],
        summaryCounts,
        summaryTotals,
        filters: {
            project: projectId,
            status,
            type
        }
    };
};
