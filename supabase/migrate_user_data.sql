-- Migration Script: Move data from Old User to New User and Delete Old User
-- Pair 2: 54c1e078... -> 3148805a...

DO $$
DECLARE
    old_user_id uuid := '54c1e078-700f-4690-a14f-fa2f93bc28c0';
    new_user_id uuid := '3148805a-fc5a-4b82-9307-6da0917d94b8';
BEGIN
    -- 1. Update expenses (paid_by)
    UPDATE public.expenses
    SET paid_by = new_user_id
    WHERE paid_by = old_user_id;

    -- 2. Update expenses (reimbursed_by)
    UPDATE public.expenses
    SET reimbursed_by = new_user_id
    WHERE reimbursed_by = old_user_id;

    -- 3. Delete from public.profiles
    DELETE FROM public.profiles
    WHERE id = old_user_id;
    
    RAISE NOTICE 'Migration completed successfully.';
END $$;
