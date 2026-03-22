-- Merge source auth user into target auth user, move linked expense references,
-- then delete the source user.
--
-- Source: sinlapinconnextfx@gmail.com
-- Target: sinlapinnew2000@gmail.com
--
-- Important:
-- 1. Run your backup/export first.
-- 2. Run this in Supabase SQL Editor.
-- 3. This script only moves rows linked to the source auth user's UUID.
--    If you still have legacy profile UUIDs not equal to auth.users.id,
--    inspect and merge those separately.

DO $$
DECLARE
    source_email CONSTANT text := 'sinlapinconnextfx@gmail.com';
    target_email CONSTANT text := 'sinlapinnew2000@gmail.com';

    source_user auth.users%ROWTYPE;
    target_user auth.users%ROWTYPE;

    moved_paid_by_count integer := 0;
    moved_reimbursed_by_count integer := 0;
    deleted_source_profile_count integer := 0;
BEGIN
    SELECT *
    INTO source_user
    FROM auth.users
    WHERE lower(email) = lower(source_email);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Source user not found for email: %', source_email;
    END IF;

    SELECT *
    INTO target_user
    FROM auth.users
    WHERE lower(email) = lower(target_email);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target user not found for email: %', target_email;
    END IF;

    IF source_user.id = target_user.id THEN
        RAISE EXCEPTION 'Source and target users are the same user id: %', source_user.id;
    END IF;

    -- Ensure target profile exists first, otherwise FK updates on expenses will fail.
    INSERT INTO public.profiles (id, display_name, created_at)
    VALUES (
        target_user.id,
        COALESCE(
            target_user.raw_user_meta_data ->> 'full_name',
            target_user.raw_user_meta_data ->> 'name',
            split_part(target_email, '@', 1)
        ),
        COALESCE(target_user.created_at, now())
    )
    ON CONFLICT (id) DO NOTHING;

    -- Move all expense ownership from source auth UUID -> target auth UUID
    UPDATE public.expenses
    SET paid_by = target_user.id
    WHERE paid_by = source_user.id;
    GET DIAGNOSTICS moved_paid_by_count = ROW_COUNT;

    UPDATE public.expenses
    SET reimbursed_by = target_user.id
    WHERE reimbursed_by = source_user.id;
    GET DIAGNOSTICS moved_reimbursed_by_count = ROW_COUNT;

    -- Remove source profile row if it exists
    DELETE FROM public.profiles
    WHERE id = source_user.id;
    GET DIAGNOSTICS deleted_source_profile_count = ROW_COUNT;

    -- Finally remove the source auth user
    DELETE FROM auth.users
    WHERE id = source_user.id;

    RAISE NOTICE 'Merge complete.';
    RAISE NOTICE 'Source user id: %', source_user.id;
    RAISE NOTICE 'Target user id: %', target_user.id;
    RAISE NOTICE 'Moved paid_by rows: %', moved_paid_by_count;
    RAISE NOTICE 'Moved reimbursed_by rows: %', moved_reimbursed_by_count;
    RAISE NOTICE 'Deleted source profile rows: %', deleted_source_profile_count;
END $$;

-- Optional post-check:
-- SELECT id, email FROM auth.users
-- WHERE lower(email) IN (
--   lower('sinlapinconnextfx@gmail.com'),
--   lower('sinlapinnew2000@gmail.com')
-- );
--
-- SELECT paid_by, reimbursed_by, count(*)
-- FROM public.expenses
-- WHERE paid_by = '54c1e078-700f-4690-a14f-fa2f93bc28c0'
--    OR reimbursed_by = '54c1e078-700f-4690-a14f-fa2f93bc28c0'
-- GROUP BY paid_by, reimbursed_by;
