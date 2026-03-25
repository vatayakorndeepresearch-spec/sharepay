import type { PageServerLoad } from './$types';

const PAGE_SIZE = 50;

type ExpenseListSummaryRow = {
    all_count: number | null;
    unpaid_count: number | null;
    paid_count: number | null;
    income_count: number | null;
    expense_count: number | null;
    filtered_count: number | null;
    filtered_amount: number | string | null;
};

export const load: PageServerLoad = async ({ url, locals: { supabase } }) => {
    const projectId = url.searchParams.get('project') || 'all';
    const status = url.searchParams.get('status') || 'all';
    const type = url.searchParams.get('type') || 'all';
    const month = url.searchParams.get('month') || 'all';
    const q = url.searchParams.get('q')?.trim() || '';
    const pageParam = Number.parseInt(url.searchParams.get('page') || '1', 10);
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const scopedProjectId = projectId === 'all' ? null : projectId;
    const loadCount = page * PAGE_SIZE;

    let filteredQuery = supabase
        .from('expenses')
        .select(`
            id,
            amount,
            paid_at,
            description,
            transaction_type,
            is_reimbursed,
            projects (name),
            profiles!expenses_paid_by_fkey (display_name)
        `)
        .order('paid_at', { ascending: false })
        .range(0, loadCount - 1);

    if (scopedProjectId) {
        filteredQuery = filteredQuery.eq('project_id', scopedProjectId);
    }

    if (type !== 'all') {
        filteredQuery = filteredQuery.eq('transaction_type', type);
    }
    if (status === 'unpaid') {
        filteredQuery = filteredQuery.eq('is_reimbursed', false);
    } else if (status === 'paid') {
        filteredQuery = filteredQuery.eq('is_reimbursed', true);
    }
    if (q) {
        filteredQuery = filteredQuery.ilike('description', `%${q}%`);
    }
    if (month !== 'all') {
        const [y, m] = month.split('-').map(Number);
        const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
        const nextMonth = m === 12
            ? `${y + 1}-01-01`
            : `${y}-${String(m + 1).padStart(2, '0')}-01`;
        filteredQuery = filteredQuery.gte('paid_at', startDate).lt('paid_at', nextMonth);
    }

    const [
        { data: projects, error: projectsError },
        { data: expenses, error: expensesError },
        { data: summaryRows, error: summaryError }
    ] = await Promise.all([
        supabase.from('projects').select('id, name').order('name'),
        filteredQuery,
        supabase.rpc('get_expense_list_summary', {
            p_project_id: scopedProjectId,
            p_status: status,
            p_type: type,
            p_month: month
        })
    ]);

    if (projectsError) {
        console.error('Error fetching projects:', projectsError);
    }
    if (expensesError) {
        console.error('Error fetching expenses:', expensesError);
    }
    if (summaryError) {
        console.error('Error fetching expense list summary:', summaryError);
    }

    const summary = ((summaryRows as ExpenseListSummaryRow[] | null)?.[0]) || {
        all_count: 0,
        unpaid_count: 0,
        paid_count: 0,
        income_count: 0,
        expense_count: 0,
        filtered_count: 0,
        filtered_amount: 0
    };
    const filteredExpenses = expenses || [];
    const filteredCount = Number(summary.filtered_count || 0);
    const summaryTotals = {
        filteredCount,
        filteredAmount: Number(summary.filtered_amount || 0)
    };

    return {
        expenses: filteredExpenses,
        projects: projects || [],
        summaryCounts: {
            all: Number(summary.all_count || 0),
            unpaid: Number(summary.unpaid_count || 0),
            paid: Number(summary.paid_count || 0),
            income: Number(summary.income_count || 0),
            expense: Number(summary.expense_count || 0)
        },
        summaryTotals,
        filters: {
            project: projectId,
            status,
            type,
            month,
            q
        },
        pagination: {
            page,
            pageSize: PAGE_SIZE,
            hasMore: filteredCount > filteredExpenses.length
        }
    };
};
