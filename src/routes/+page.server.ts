import type { PageServerLoad } from './$types';

type SettlementState = 'you_owe' | 'owed_to_you' | 'clear' | 'unknown';
type SettlementSummaryRow = {
    state: SettlementState;
    amount: number | string | null;
    other_party_name: string | null;
    unpaid_count: number | null;
};
type ProjectFinancialSummaryRow = {
    project_id: string;
    project_name: string;
    income_total: number | string | null;
    expense_total: number | string | null;
};

export const load: PageServerLoad = async ({ locals: { supabase }, parent }) => {
    const parentPromise = parent();
    const recentExpensesPromise = supabase
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
        .limit(8);
    const projectSummaryPromise = supabase.rpc('get_project_financial_summary');

    const { currentProfileId, currentUser } = await parentPromise;
    const settlementPromise = currentProfileId
        ? supabase.rpc('get_settlement_summary', { p_current_profile_id: currentProfileId })
        : Promise.resolve({
            data: [{
                state: 'unknown' as SettlementState,
                amount: 0,
                other_party_name: null,
                unpaid_count: 0
            }],
            error: null
        });

    const [
        { data: expenses, error: expensesError },
        { data: projectSummaryRows, error: projectSummaryError },
        { data: settlementRows, error: settlementError }
    ] = await Promise.all([
        recentExpensesPromise,
        projectSummaryPromise,
        settlementPromise
    ]);

    if (expensesError) {
        console.error('Error fetching recent expenses:', expensesError);
    }
    if (projectSummaryError) {
        console.error('Error fetching project financial summary:', projectSummaryError);
    }
    if (settlementError) {
        console.error('Error fetching settlement summary:', settlementError);
    }

    const projectSummary: Record<string, { name: string; income: number; expense: number }> = {};
    (projectSummaryRows as ProjectFinancialSummaryRow[] | null)?.forEach((row) => {
        projectSummary[row.project_id] = {
            name: row.project_name || 'ไม่ระบุโปรเจค',
            income: Number(row.income_total || 0),
            expense: Number(row.expense_total || 0)
        };
    });

    const settlementRow = ((settlementRows as SettlementSummaryRow[] | null)?.[0]) || {
        state: 'unknown' as SettlementState,
        amount: 0,
        other_party_name: null,
        unpaid_count: 0
    };
    const settlementState = settlementRow.state;
    const settlementAmount = Number(settlementRow.amount || 0);
    const otherPartyName = settlementRow.other_party_name;
    const unpaidCount = Number(settlementRow.unpaid_count || 0);

    const settlementSummary = {
        state: settlementState,
        amount: settlementAmount,
        otherPartyName,
        unpaidCount,
        headline:
            settlementState === 'you_owe'
                ? `คุณต้องโอน ${otherPartyName || 'อีกฝ่าย'}`
                : settlementState === 'owed_to_you'
                  ? `${otherPartyName || 'อีกฝ่าย'} ต้องโอนให้คุณ`
                  : settlementState === 'clear'
                    ? 'ตอนนี้ไม่มีรายการค้าง'
                    : 'พร้อมเริ่มบันทึกรายการ',
        subline:
            settlementState === 'you_owe'
                ? 'เปิดรายการค้างแล้วเคลียร์ยอดจากหน้ารายละเอียดได้ทันที'
                : settlementState === 'owed_to_you'
                  ? 'ดูรายการที่ยังไม่เคลียร์เพื่อเช็กยอดและหลักฐาน'
                  : settlementState === 'clear'
                    ? 'ถ้ามีรายการใหม่ เพิ่มได้ทันทีจากปุ่มบันทึกด้านล่าง'
                    : 'เชื่อมบัญชีผู้ใช้กับโปรไฟล์ก่อนเพื่อดูยอดแบบเฉพาะตัว',
        ctaLabel:
            settlementState === 'you_owe'
                ? 'เคลียร์ยอดตอนนี้'
                : settlementState === 'owed_to_you'
                  ? 'ดูรายการค้าง'
                  : 'บันทึกรายการใหม่',
        ctaHref:
            settlementState === 'clear' || settlementState === 'unknown'
                ? '/expenses/new'
                : '/expenses?status=unpaid'
    };

    return {
        currentUser,
        expenses: expenses || [],
        projectSummary,
        settlementSummary
    };
};
