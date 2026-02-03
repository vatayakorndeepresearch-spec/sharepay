-- 1. Create the profiles table if it doesn't exist
-- Using the structure provided by the user
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  display_name text NOT NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

-- 2. Merge duplicate profiles for 'Sinlapin Jantarat'
DO $$
DECLARE
    primary_id uuid;
    secondary_id uuid;
    found_count int;
BEGIN
    -- Check how many profiles with this name exist
    SELECT count(*) INTO found_count FROM public.profiles WHERE display_name = 'Sinlapin Jantarat';
    
    IF found_count > 1 THEN
        -- Find the primary (the one created first)
        SELECT id INTO primary_id 
        FROM public.profiles 
        WHERE display_name = 'Sinlapin Jantarat' 
        ORDER BY created_at ASC 
        LIMIT 1;

        -- Find the secondary (the one created later)
        -- In case there are more than 2, we will loop or just handle the first extra one found.
        -- The user said there are 2, so this should be fine.
        FOR secondary_id IN 
            SELECT id FROM public.profiles 
            WHERE display_name = 'Sinlapin Jantarat' AND id != primary_id
        LOOP
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
        END LOOP;
    ELSE
        RAISE NOTICE 'Found % profiles for "Sinlapin Jantarat". No merge needed.', found_count;
    END IF;
END $$;
