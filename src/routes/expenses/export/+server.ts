import { supabase } from '$lib/supabaseClient';
import * as XLSX from 'xlsx';

export async function GET({ url }) {
    const projectId = url.searchParams.get('project');
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('type');

    let query = supabase
        .from('expenses')
        .select(`
            *,
            projects (name),
            profiles!paid_by (display_name)
        `)
        .order('paid_at', { ascending: false });

    if (projectId && projectId !== 'all') {
        query = query.eq('project_id', projectId);
    }

    if (type && type !== 'all') {
        query = query.eq('transaction_type', type);
    }

    if (status && status !== 'all') {
        if (status === 'paid') {
            query = query.eq('is_reimbursed', true);
        } else if (status === 'unpaid') {
            query = query.eq('is_reimbursed', false);
        }
    }

    const { data: expenses, error } = await query;

    if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    const data = expenses.map(e => ({
        'Date': e.paid_at,
        'Project': e.projects?.name,
        'Type': e.transaction_type === 'income' ? 'Income' : 'Expense',
        'Category': e.category,
        'Description': e.description,
        'Amount': e.amount,
        'Paid By': e.profiles?.display_name,
        'Status': e.transaction_type === 'income' ? '-' : (e.is_reimbursed ? 'Cleared' : 'Waiting')
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Expenses");

    const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new Response(buf, {
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="expenses.xlsx"'
        }
    });
}
