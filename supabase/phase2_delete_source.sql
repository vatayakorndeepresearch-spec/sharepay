-- Phase 2: Delete source user/profile after phase 1 is verified
--
-- Preconditions:
-- 1. Backup/export already completed
-- 2. phase1_merge_only.sql has been run successfully
-- 3. Post-check 2 from phase 1 returned:
--    remaining_paid_by_refs = 0
--    remaining_reimbursed_by_refs = 0
-- 4. App was sanity-checked with target user and data looks correct

BEGIN;

DO $$
DECLARE
    source_email CONSTANT text := 'sinlapinconnextfx@gmail.com';
    source_user auth.users%ROWTYPE;
    remaining_paid_by_count integer := 0;
    remaining_reimbursed_by_count integer := 0;
    deleted_profile_count integer := 0;
    deleted_auth_user_count integer := 0;
BEGIN
    SELECT *
    INTO source_user
    FROM auth.users
    WHERE lower(email) = lower(source_email);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Source user not found for email: %', source_email;
    END IF;

    SELECT count(*)
    INTO remaining_paid_by_count
    FROM public.expenses
    WHERE paid_by = source_user.id;

    SELECT count(*)
    INTO remaining_reimbursed_by_count
    FROM public.expenses
    WHERE reimbursed_by = source_user.id;

    IF remaining_paid_by_count > 0 OR remaining_reimbursed_by_count > 0 THEN
        RAISE EXCEPTION
            'Cannot delete source user. Remaining refs found. paid_by=%, reimbursed_by=%',
            remaining_paid_by_count,
            remaining_reimbursed_by_count;
    END IF;

    DELETE FROM public.profiles
    WHERE id = source_user.id;
    GET DIAGNOSTICS deleted_profile_count = ROW_COUNT;

    DELETE FROM auth.users
    WHERE id = source_user.id;
    GET DIAGNOSTICS deleted_auth_user_count = ROW_COUNT;

    RAISE NOTICE 'Phase 2 delete complete.';
    RAISE NOTICE 'Deleted source profile rows: %', deleted_profile_count;
    RAISE NOTICE 'Deleted source auth user rows: %', deleted_auth_user_count;
END $$;

COMMIT;

-- ============================================
-- Post-check 1: source user should be gone
-- ============================================
SELECT id, email
FROM auth.users
WHERE lower(email) = lower('sinlapinconnextfx@gmail.com');

-- ============================================
-- Post-check 2: source profile should be gone
-- ============================================
SELECT id, display_name, created_at
FROM public.profiles
WHERE id NOT IN (SELECT id FROM auth.users)
  AND lower(display_name) LIKE '%sinlapin%';

-- ============================================
-- Post-check 3: source references should still be zero
-- ============================================
WITH source_id AS (
    SELECT '00000000-0000-0000-0000-000000000000'::uuid AS id
)
SELECT
    count(*) FILTER (WHERE paid_by IN (SELECT id FROM source_id)) AS remaining_paid_by_refs,
    count(*) FILTER (WHERE reimbursed_by IN (SELECT id FROM source_id)) AS remaining_reimbursed_by_refs
FROM public.expenses;
