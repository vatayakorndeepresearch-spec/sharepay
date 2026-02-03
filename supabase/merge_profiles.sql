-- 1. Identify the profiles for 'Sinlapin Jantarat'
-- Run this first to see the IDs if you want to be precise
-- SELECT id, display_name, created_at FROM public.profiles WHERE display_name = 'Sinlapin Jantarat';

-- 2. Define the Primary (Keep) and Secondary (Delete) IDs
-- Replacing these placeholders with actual IDs from the query above is recommended
-- For this script, we'll assume the one with the EARLIER created_at is the primary.

DO $$
DECLARE
    primary_id uuid;
    secondary_id uuid;
BEGIN
    -- Find the two profiles
    SELECT id INTO primary_id 
    FROM public.profiles 
    WHERE display_name = 'Sinlapin Jantarat' 
    ORDER BY created_at ASC 
    LIMIT 1;

    SELECT id INTO secondary_id 
    FROM public.profiles 
    WHERE display_name = 'Sinlapin Jantarat' 
    AND id != primary_id
    LIMIT 1;

    IF primary_id IS NOT NULL AND secondary_id IS NOT NULL THEN
        -- Update expenses where the secondary profile was the payer
        UPDATE public.expenses 
        SET paid_by = primary_id 
        WHERE paid_by = secondary_id;

        -- Update expenses where the secondary profile was the reimbursers
        UPDATE public.expenses 
        SET reimbursed_by = primary_id 
        WHERE reimbursed_by = secondary_id;

        -- Delete the secondary profile
        DELETE FROM public.profiles 
        WHERE id = secondary_id;
        
        RAISE NOTICE 'Merged profile % into %', secondary_id, primary_id;
    ELSE
        RAISE NOTICE 'Could not find two profiles with the name Sinlapin Jantarat';
    END IF;
END $$;
