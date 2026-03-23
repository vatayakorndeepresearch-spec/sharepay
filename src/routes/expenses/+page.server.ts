import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals: { supabase } }) => {
    const projectId = url.searchParams.get('project') || 'all';
    const status = url.searchParams.get('status') || 'all';
    const type = url.searchParams.get('type') || 'all';

    // Build filtered query (for display)
    let filteredQuery = supabase
        .from('expenses')
        .select(`
            *,
            projects (name),
            profiles!expenses_paid_by_fkey (display_name)
        `)
        .order('paid_at', { ascending: false });

    // Build summary query (project-scoped only, for counts)
    let summaryQuery = supabase
        .from('expenses')
        .select('transaction_type, is_reimbursed, amount');

    if (projectId !== 'all') {
        filteredQuery = filteredQuery.eq('project_id', projectId);
        summaryQuery = summaryQuery.eq('project_id', projectId);
    }

    // Push type/status filters into DB
    if (type !== 'all') {
        filteredQuery = filteredQuery.eq('transaction_type', type);
    }
    if (status === 'unpaid') {
        filteredQuery = filteredQuery.eq('is_reimbursed', false);
    } else if (status === 'paid') {
        filteredQuery = filteredQuery.eq('is_reimbursed', true);
    }

    // Run all queries in parallel
    const [{ data: projects }, { data: expenses }, { data: summaryRows }] = await Promise.all([
        supabase.from('projects').select('id, name').order('name'),
        filteredQuery,
        summaryQuery
    ]);

    // Single-pass summary counts
    const summaryCounts = { all: 0, unpaid: 0, paid: 0, income: 0, expense: 0 };
    for (const row of summaryRows || []) {
        summaryCounts.all++;
        if (row.transaction_type === 'income') {
            summaryCounts.income++;
        } else {
            summaryCounts.expense++;
            if (row.is_reimbursed) {
                summaryCounts.paid++;
            } else {
                summaryCounts.unpaid++;
            }
        }
    }

    const filteredExpenses = expenses || [];
    const summaryTotals = {
        filteredCount: filteredExpenses.length,
        filteredAmount: filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0)
    };

    return {
        expenses: filteredExpenses,
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
