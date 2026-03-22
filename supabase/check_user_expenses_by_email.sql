-- Read-only diagnostic for checking whether a specific auth email
-- is linked to any profile or expenses in the current Supabase project.
--
-- Usage:
-- 1. Open Supabase SQL Editor
-- 2. Paste this file
-- 3. Change the email in the params CTE if needed
-- 4. Run all queries

-- ============================================
-- 0. Parameters
-- ============================================
WITH params AS (
    SELECT
        'sinlapinconnextfx@gmail.com'::text AS target_email,
        'sinlapin'::text AS name_hint
)
SELECT * FROM params;

-- ============================================
-- 1. Auth user record for this email
-- ============================================
WITH params AS (
    SELECT 'sinlapinconnextfx@gmail.com'::text AS target_email
)
SELECT
    u.id,
    u.email,
    u.created_at,
    u.last_sign_in_at,
    u.raw_user_meta_data
FROM auth.users u
JOIN params p
    ON lower(u.email) = lower(p.target_email);

-- ============================================
-- 2. Profile linked by the same UUID as auth.users.id
--    This is the most reliable match if auth/profile integration is correct.
-- ============================================
WITH params AS (
    SELECT 'sinlapinconnextfx@gmail.com'::text AS target_email
),
target_user AS (
    SELECT id
    FROM auth.users
    WHERE lower(email) = lower((SELECT target_email FROM params))
)
SELECT
    p.id,
    p.display_name,
    p.created_at
FROM public.profiles p
JOIN target_user u
    ON p.id = u.id;

-- ============================================
-- 3. Candidate profiles by display name hint
--    Useful when auth user exists but no matching profile UUID exists yet.
-- ============================================
WITH params AS (
    SELECT 'sinlapin'::text AS name_hint
)
SELECT
    p.id,
    p.display_name,
    p.created_at
FROM public.profiles p
JOIN params par
    ON lower(p.display_name) LIKE '%' || lower(par.name_hint) || '%'
ORDER BY p.created_at ASC;

-- ============================================
-- 4. Expenses directly linked to auth.users.id
--    This catches cases where expenses were already written with auth uid
--    even if the profile row is missing.
-- ============================================
WITH params AS (
    SELECT 'sinlapinconnextfx@gmail.com'::text AS target_email
),
target_user AS (
    SELECT id
    FROM auth.users
    WHERE lower(email) = lower((SELECT target_email FROM params))
)
SELECT
    'paid_by' AS relation,
    e.id,
    e.description,
    e.amount,
    e.paid_at,
    e.transaction_type,
    e.is_reimbursed,
    e.paid_by,
    e.reimbursed_by,
    pr.name AS project_name
FROM public.expenses e
LEFT JOIN public.projects pr
    ON pr.id = e.project_id
WHERE e.paid_by IN (SELECT id FROM target_user)

UNION ALL

SELECT
    'reimbursed_by' AS relation,
    e.id,
    e.description,
    e.amount,
    e.paid_at,
    e.transaction_type,
    e.is_reimbursed,
    e.paid_by,
    e.reimbursed_by,
    pr.name AS project_name
FROM public.expenses e
LEFT JOIN public.projects pr
    ON pr.id = e.project_id
WHERE e.reimbursed_by IN (SELECT id FROM target_user)

ORDER BY paid_at DESC, relation;

-- ============================================
-- 5. Expenses linked to candidate Sinlapin profiles
--    Useful when old/manual profiles existed before auth.
-- ============================================
WITH params AS (
    SELECT 'sinlapin'::text AS name_hint
),
candidate_profiles AS (
    SELECT p.id
    FROM public.profiles p
    JOIN params par
        ON lower(p.display_name) LIKE '%' || lower(par.name_hint) || '%'
)
SELECT
    'paid_by' AS relation,
    e.id,
    e.description,
    e.amount,
    e.paid_at,
    e.transaction_type,
    e.is_reimbursed,
    e.paid_by,
    e.reimbursed_by,
    pr.name AS project_name
FROM public.expenses e
LEFT JOIN public.projects pr
    ON pr.id = e.project_id
WHERE e.paid_by IN (SELECT id FROM candidate_profiles)

UNION ALL

SELECT
    'reimbursed_by' AS relation,
    e.id,
    e.description,
    e.amount,
    e.paid_at,
    e.transaction_type,
    e.is_reimbursed,
    e.paid_by,
    e.reimbursed_by,
    pr.name AS project_name
FROM public.expenses e
LEFT JOIN public.projects pr
    ON pr.id = e.project_id
WHERE e.reimbursed_by IN (SELECT id FROM candidate_profiles)

ORDER BY paid_at DESC, relation;

-- ============================================
-- 6. Quick summary counts
-- ============================================
WITH params AS (
    SELECT
        'sinlapinconnextfx@gmail.com'::text AS target_email,
        'sinlapin'::text AS name_hint
),
target_user AS (
    SELECT id
    FROM auth.users
    WHERE lower(email) = lower((SELECT target_email FROM params))
),
candidate_profiles AS (
    SELECT p.id
    FROM public.profiles p
    JOIN params par
        ON lower(p.display_name) LIKE '%' || lower(par.name_hint) || '%'
),
all_candidate_ids AS (
    SELECT id FROM target_user
    UNION
    SELECT id FROM candidate_profiles
)
SELECT
    count(*) FILTER (WHERE paid_by IN (SELECT id FROM all_candidate_ids)) AS paid_by_count,
    count(*) FILTER (WHERE reimbursed_by IN (SELECT id FROM all_candidate_ids)) AS reimbursed_by_count,
    coalesce(sum(amount) FILTER (WHERE paid_by IN (SELECT id FROM all_candidate_ids)), 0) AS paid_by_total,
    coalesce(sum(amount) FILTER (WHERE reimbursed_by IN (SELECT id FROM all_candidate_ids)), 0) AS reimbursed_by_total
FROM public.expenses;
