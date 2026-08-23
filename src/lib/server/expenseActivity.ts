import type { SupabaseClient, User } from '@supabase/supabase-js';

export type ExpenseAction = 'create' | 'update' | 'reimburse' | 'unreimburse' | 'delete';

export type ExpenseSnapshot = {
    description?: string | null;
    amount?: number | null;
    transaction_type?: string | null;
    project_name?: string | null;
    /** Settlement fields as they were before the action, so undo can restore them. */
    previous?: {
        is_reimbursed?: boolean | null;
        reimbursed_at?: string | null;
        reimbursed_by?: string | null;
        reimbursement_proof_url?: string | null;
    };
    /** Set on the event written by an undo, pointing at the event it rolled back. */
    undo_of?: string;
};

export type ActivityRow = {
    id: string;
    expense_id: string | null;
    action: ExpenseAction;
    actor_name: string | null;
    snapshot: ExpenseSnapshot | null;
    undone_at: string | null;
    created_at: string;
};

export const ACTIVITY_SELECT = 'id, expense_id, action, actor_name, snapshot, undone_at, created_at';

/** Only settlement flips are reversible; edits and deletes are not. */
export const isUndoable = (row: Pick<ActivityRow, 'action' | 'expense_id' | 'undone_at'>) =>
    !row.undone_at && !!row.expense_id && (row.action === 'reimburse' || row.action === 'unreimburse');

export const actorName = (user: User | null) =>
    (user?.user_metadata?.full_name as string | undefined) || user?.email || null;

/**
 * Append one activity row. Logging is best-effort: a failure here must never
 * break the action the user actually asked for, so errors are logged, not thrown.
 */
export async function logExpenseActivity(
    supabase: SupabaseClient,
    entry: {
        expenseId: string | null;
        action: ExpenseAction;
        user: User | null;
        snapshot?: ExpenseSnapshot;
    }
): Promise<string | null> {
    const { data, error } = await supabase
        .from('expense_activity')
        .insert({
            expense_id: entry.expenseId,
            action: entry.action,
            actor_id: entry.user?.id ?? null,
            actor_name: actorName(entry.user),
            snapshot: entry.snapshot ?? {}
        })
        .select('id')
        .single();

    if (error) {
        console.error('Activity log error:', error);
        return null;
    }

    return data?.id ?? null;
}

/** Reads the columns the feed renders, so a row survives the expense being deleted. */
export async function snapshotExpense(
    supabase: SupabaseClient,
    expenseId: string
): Promise<ExpenseSnapshot> {
    const { data } = await supabase
        .from('expenses')
        .select('description, amount, transaction_type, is_reimbursed, reimbursed_at, reimbursed_by, reimbursement_proof_url, projects (name)')
        .eq('id', expenseId)
        .single();

    if (!data) return {};

    const project = data.projects as { name?: string } | { name?: string }[] | null;
    const projectName = Array.isArray(project) ? project[0]?.name : project?.name;

    return {
        description: data.description,
        amount: Number(data.amount ?? 0),
        transaction_type: data.transaction_type,
        project_name: projectName ?? null,
        previous: {
            is_reimbursed: data.is_reimbursed,
            reimbursed_at: data.reimbursed_at,
            reimbursed_by: data.reimbursed_by,
            reimbursement_proof_url: data.reimbursement_proof_url
        }
    };
}
