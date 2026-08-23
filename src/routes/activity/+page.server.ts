import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import {
    ACTIVITY_SELECT,
    isUndoable,
    logExpenseActivity,
    type ActivityRow
} from '$lib/server/expenseActivity';

const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ url, locals: { supabase } }) => {
    const pageParam = Number.parseInt(url.searchParams.get('page') || '1', 10);
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

    const { data, error: activityError } = await supabase
        .from('expense_activity')
        .select(ACTIVITY_SELECT)
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (activityError) {
        console.error('Error fetching activity:', activityError);
    }

    const activities = (data || []) as ActivityRow[];

    return {
        activities,
        page,
        hasMore: activities.length === PAGE_SIZE
    };
};

export const actions: Actions = {
    undo: async ({ request, locals: { supabase, user } }) => {
        const formData = await request.formData();
        const activityId = formData.get('activity_id') as string;

        if (!activityId) {
            return fail(400, { error: 'ไม่พบรายการที่ต้องการย้อนกลับ' });
        }

        const { data: activity } = await supabase
            .from('expense_activity')
            .select(ACTIVITY_SELECT)
            .eq('id', activityId)
            .single<ActivityRow>();

        if (!activity) {
            return fail(404, { error: 'ไม่พบประวัติรายการนี้' });
        }
        if (!isUndoable(activity)) {
            return fail(400, { error: 'รายการนี้ย้อนกลับไม่ได้' });
        }

        // Undoing a clear puts the expense back to unpaid; undoing an unclear
        // restores the settlement fields captured before they were wiped.
        const previous = activity.snapshot?.previous ?? {};
        const updates =
            activity.action === 'reimburse'
                ? {
                    is_reimbursed: false,
                    reimbursed_at: null,
                    reimbursed_by: null,
                    reimbursement_proof_url: null
                }
                : {
                    is_reimbursed: true,
                    reimbursed_at: previous.reimbursed_at ?? new Date().toISOString(),
                    reimbursed_by: previous.reimbursed_by ?? null,
                    reimbursement_proof_url: previous.reimbursement_proof_url ?? null
                };

        const { error: updateError } = await supabase
            .from('expenses')
            .update(updates)
            .eq('id', activity.expense_id as string);

        if (updateError) {
            console.error('Undo error:', updateError);
            return fail(500, { error: 'ย้อนกลับไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
        }

        await supabase
            .from('expense_activity')
            .update({ undone_at: new Date().toISOString() })
            .eq('id', activityId);

        await logExpenseActivity(supabase, {
            expenseId: activity.expense_id,
            action: activity.action === 'reimburse' ? 'unreimburse' : 'reimburse',
            user,
            snapshot: { ...(activity.snapshot ?? {}), undo_of: activityId }
        });

        return { success: true };
    }
};
