-- Phase 1: Merge only
-- Move expense references from source auth user to target auth user
-- without deleting the source auth user or source profile yet.
--
-- Source: sinlapinconnextfx@gmail.com
-- Target: sinlapinnew2000@gmail.com
--
-- Safe usage:
-- 1. Run backup/export first
-- 2. Run this script
-- 3. Verify that all expenses now point to target user id
-- 4. Only after verification, run a separate phase-2 delete script

BEGIN;

DO $$
DECLARE
    source_email CONSTANT text := 'sinlapinconnextfx@gmail.com';
    target_email CONSTANT text := 'sinlapinnew2000@gmail.com';

    source_user auth.users%ROWTYPE;
    target_user auth.users%ROWTYPE;

    moved_paid_by_count integer := 0;
    moved_reimbursed_by_count integer := 0;
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

    -- Ensure target profile exists, otherwise FK updates can fail.
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

    RAISE NOTICE 'Phase 1 merge complete.';
    RAISE NOTICE 'Source user id: %', source_user.id;
    RAISE NOTICE 'Target user id: %', target_user.id;
    RAISE NOTICE 'Moved paid_by rows: %', moved_paid_by_count;
    RAISE NOTICE 'Moved reimbursed_by rows: %', moved_reimbursed_by_count;
    RAISE NOTICE 'Source auth user/profile are intentionally NOT deleted in phase 1.';
END $$;

COMMIT;

-- ============================================
-- Post-check 1: confirm source/target users still exist
-- ============================================
SELECT id, email
FROM auth.users
WHERE lower(email) IN (
    lower('sinlapinconnextfx@gmail.com'),
    lower('sinlapinnew2000@gmail.com')
)
ORDER BY email;

-- ============================================
-- Post-check 2: confirm no expenses still point to source user id
-- ============================================
WITH source_user AS (
    SELECT id
    FROM auth.users
    WHERE lower(email) = lower('sinlapinconnextfx@gmail.com')
)
SELECT
    count(*) FILTER (WHERE paid_by IN (SELECT id FROM source_user)) AS remaining_paid_by_refs,
    count(*) FILTER (WHERE reimbursed_by IN (SELECT id FROM source_user)) AS remaining_reimbursed_by_refs
FROM public.expenses;

-- ============================================
-- Post-check 3: compare totals now linked to target user id
-- ============================================
WITH target_user AS (
    SELECT id
    FROM auth.users
    WHERE lower(email) = lower('sinlapinnew2000@gmail.com')
)
SELECT
    count(*) FILTER (WHERE paid_by IN (SELECT id FROM target_user)) AS target_paid_by_count,
    count(*) FILTER (WHERE reimbursed_by IN (SELECT id FROM target_user)) AS target_reimbursed_by_count,
    coalesce(sum(amount) FILTER (WHERE paid_by IN (SELECT id FROM target_user)), 0) AS target_paid_by_total,
    coalesce(sum(amount) FILTER (WHERE reimbursed_by IN (SELECT id FROM target_user)), 0) AS target_reimbursed_by_total
FROM public.expenses;
