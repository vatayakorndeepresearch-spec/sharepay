import type { PageServerLoad } from './$types';

type SettlementState = 'you_owe' | 'owed_to_you' | 'clear' | 'unknown';

export const load: PageServerLoad = async ({ locals: { supabase }, parent }) => {
    const { currentProfileId, currentUser } = await parent();

    const [{ data: expenses }, { data: allExpenses }, { data: profiles }] = await Promise.all([
        supabase
            .from('expenses')
            .select(`
                *,
                projects (name),
                profiles!expenses_paid_by_fkey (display_name)
            `)
            .order('paid_at', { ascending: false })
            .limit(8),
        supabase
            .from('expenses')
            .select(`
                amount,
                transaction_type,
                paid_by,
                is_reimbursed,
                projects (id, name)
            `)
            .limit(5000),
        supabase
            .from('profiles')
            .select('id, display_name')
            .order('created_at', { ascending: true })
            .limit(2)
    ]);

    const projectSummary: Record<string, { name: string; income: number; expense: number }> = {};
    const payerMap: Record<string, number> = {};
    let unpaidCount = 0;

    allExpenses?.forEach((item) => {
        const project = item.projects as { id?: string; name?: string } | null;
        if (project?.id) {
            if (!projectSummary[project.id]) {
                projectSummary[project.id] = {
                    name: project.name || 'ไม่ระบุโปรเจค',
                    income: 0,
                    expense: 0
                };
            }

            if (item.transaction_type === 'income') {
                projectSummary[project.id].income += Number(item.amount);
            } else {
                projectSummary[project.id].expense += Number(item.amount);
            }
        }

        if (item.transaction_type === 'expense' && !item.is_reimbursed) {
            payerMap[item.paid_by] = (payerMap[item.paid_by] || 0) + Number(item.amount);
            unpaidCount++;
        }
    });

    let settlementState: SettlementState = 'unknown';
    let settlementAmount = 0;
    let otherPartyName: string | null = null;

    if (profiles && profiles.length >= 2 && currentProfileId && profiles.some((profile) => profile.id === currentProfileId)) {
        const currentProfile = profiles.find((profile) => profile.id === currentProfileId)!;
        const otherProfile = profiles.find((profile) => profile.id !== currentProfileId)!;
        const currentPaid = payerMap[currentProfile.id] || 0;
        const otherPaid = payerMap[otherProfile.id] || 0;
        const diff = currentPaid - otherPaid;

        otherPartyName = otherProfile.display_name;

        if (diff > 0) {
            settlementState = 'owed_to_you';
            settlementAmount = diff;
        } else if (diff < 0) {
            settlementState = 'you_owe';
            settlementAmount = Math.abs(diff);
        } else {
            settlementState = 'clear';
        }
    }

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
