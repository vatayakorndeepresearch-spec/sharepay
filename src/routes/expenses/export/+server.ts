import * as XLSX from 'xlsx';

const EXPORT_ROW_LIMIT = 5000;

function escapeCsvField(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

function toCsv(rows: Record<string, unknown>[]): string {
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const lines = [
        headers.map(h => escapeCsvField(h)).join(','),
        ...rows.map(row =>
            headers.map(h => escapeCsvField(String(row[h] ?? ''))).join(',')
        )
    ];
    return '\uFEFF' + lines.join('\r\n');
}

export async function GET({ url, locals: { supabase } }) {
    const projectId = url.searchParams.get('project');
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('type');
    const month = url.searchParams.get('month');
    const q = url.searchParams.get('q')?.trim() || '';
    const format = url.searchParams.get('format') || 'xlsx';

    let query = supabase
        .from('expenses')
        .select(`
            *,
            projects (name),
            profiles!expenses_paid_by_fkey (display_name)
        `)
        .order('paid_at', { ascending: false })
        .limit(EXPORT_ROW_LIMIT);

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

    if (month && month !== 'all') {
        const [y, m] = month.split('-').map(Number);
        const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
        const nextM = m === 12 ? 1 : m + 1;
        const nextY = m === 12 ? y + 1 : y;
        const endDate = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
        query = query.gte('paid_at', startDate).lt('paid_at', endDate);
    }

    // Must mirror the list page's search so the export matches what the user sees.
    if (q) {
        const escaped = q.replace(/[%,()]/g, ' ');
        query = query.or(
            `description.ilike.%${escaped}%,notes.ilike.%${escaped}%,category.ilike.%${escaped}%`
        );
    }

    const { data: expenses, error } = await query;

    if (error) {
        console.error('Export error:', error);
        return new Response(JSON.stringify({ error: 'เกิดข้อผิดพลาดในการส่งออกข้อมูล' }), { status: 500 });
    }

    const data = expenses.map(e => ({
        'Date': e.paid_at,
        'Project': e.projects?.name,
        'Type': e.transaction_type === 'income' ? 'Income' : 'Expense',
        'Category': e.category,
        'Description': e.description,
        'Note': e.notes,
        'Amount': e.amount,
        'Paid By': e.profiles?.display_name,
        'Status': e.transaction_type === 'income' ? '-' : (e.is_reimbursed ? 'Cleared' : 'Waiting')
    }));

    const filename = month && month !== 'all' ? `expenses-${month}` : 'expenses';

    if (format === 'csv') {
        const csv = toCsv(data);
        return new Response(csv, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}.csv"`
            }
        });
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Expenses");

    const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new Response(buf, {
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${filename}.xlsx"`
        }
    });
}
