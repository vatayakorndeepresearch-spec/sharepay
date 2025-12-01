export interface Profile {
    id: string;
    display_name: string;
    created_at: string;
}

export interface Project {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    created_at: string;
}

export interface Expense {
    id: string;
    project_id: string;
    transaction_type: 'expense' | 'income';
    paid_by: string;
    amount: number;
    currency: string;
    paid_at: string;
    description: string;
    category: string;
    is_reimbursed: boolean;
    reimbursed_at: string | null;
    reimbursed_by: string | null;
    reimbursement_proof_url: string | null;
    proof_image_url: string | null;
    attachments?: { id: string; file_url: string; file_type: string }[] | null;
    notes: string | null;
    created_at: string;

    // Joins
    profiles?: Profile; // paid_by
    projects?: Project;
    reimburser?: Profile; // reimbursed_by
}
