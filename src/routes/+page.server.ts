import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
    // Fetch recent expenses
    const { data: expenses } = await supabase
        .from('expenses')
        .select(`
      *,
      projects (name),
      profiles!expenses_paid_by_fkey (display_name)
    `)
        .order('paid_at', { ascending: false })
        .limit(10);

    // Calculate debts
    const { data: debts } = await supabase
        .from('expenses')
        .select(`
      amount,
      paid_by,
      profiles!expenses_paid_by_fkey (display_name)
    `)
        .eq('is_reimbursed', false);

    // Group by Payer
    const debtSummary: Record<string, { name: string, amount: number }> = {};

    if (debts) {
        debts.forEach((debt) => {
            const payerId = debt.paid_by;
            // Handle potential array return from Supabase join
            const profileData = debt.profiles as any;
            const payerName = Array.isArray(profileData)
                ? profileData[0]?.display_name
                : profileData?.display_name || 'Unknown';

            if (!debtSummary[payerId]) {
                debtSummary[payerId] = { name: payerName, amount: 0 };
            }
            debtSummary[payerId].amount += debt.amount;
        });
    }

    // Calculate Project Totals
    const { data: allExpenses } = await supabase
        .from('expenses')
        .select(`
            amount,
            transaction_type,
            projects (id, name)
        `);

    const projectSummary: Record<string, { name: string, income: number, expense: number }> = {};

    if (allExpenses) {
        allExpenses.forEach((item) => {
            const project = item.projects as any;
            const projectId = project?.id;
            const projectName = project?.name || 'Unknown';

            if (!projectId) return;

            if (!projectSummary[projectId]) {
                projectSummary[projectId] = { name: projectName, income: 0, expense: 0 };
            }

            if (item.transaction_type === 'income') {
                projectSummary[projectId].income += item.amount;
            } else {
                projectSummary[projectId].expense += item.amount;
            }
        });
    }

    // Calculate Net Balance (Who owes whom)
    // Assumption: All expenses are split 50/50 between 2 people (พี่, น้อง)
    // We need to find the 2 profiles first
    const { data: profiles } = await supabase.from('profiles').select('id, display_name');

    let netBalance = {
        debtor: null as string | null, // Who owes
        creditor: null as string | null, // Who is owed
        amount: 0
    };

    if (profiles && profiles.length === 2) {
        // Calculate total paid by each person (only for UNREIMBURSED expenses)
        // Actually, we should look at ALL expenses that are NOT reimbursed yet.
        // If it is reimbursed, it's settled.

        const { data: unpaidExpenses } = await supabase
            .from('expenses')
            .select('amount, paid_by, transaction_type')
            .eq('is_reimbursed', false);

        if (unpaidExpenses) {
            const paidMap: Record<string, number> = {};
            profiles.forEach(p => paidMap[p.id] = 0);

            unpaidExpenses.forEach(item => {
                if (item.transaction_type === 'expense') {
                    paidMap[item.paid_by] += item.amount;
                } else {
                    // Income: If A receives 100, A "owes" B 50.
                    // So it's like A paid -100 (deficit).
                    // Or simpler: Treat Income as negative expense.
                    paidMap[item.paid_by] -= item.amount;
                }
            });

            const totalPaid = Object.values(paidMap).reduce((a, b) => a + b, 0);
            const sharePerPerson = totalPaid / 2;

            // Calculate Net
            const p1 = profiles[0];
            const p2 = profiles[1];

            const p1_net = paidMap[p1.id] - sharePerPerson;
            // const p2_net = paidMap[p2.id] - sharePerPerson;

            if (p1_net > 0) {
                // P1 paid more, P2 owes P1
                netBalance = {
                    debtor: p2.display_name,
                    creditor: p1.display_name,
                    amount: p1_net
                };
            } else if (p1_net < 0) {
                // P1 paid less, P1 owes P2
                netBalance = {
                    debtor: p1.display_name,
                    creditor: p2.display_name,
                    amount: Math.abs(p1_net)
                };
            }
        }
    }

    return {
        expenses: expenses || [],
        debtSummary,
        projectSummary,
        netBalance
    };
};
