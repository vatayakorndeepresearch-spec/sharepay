-- Export current app data as SQL INSERT statements.
--
-- How to use:
-- 1. Open Supabase SQL Editor
-- 2. Paste this file and run it
-- 3. Copy the result rows from the `sql_line` column
-- 4. Save as something like: sharepay_data_backup.sql
--
-- Notes:
-- - This exports table data only, not storage file contents.
-- - For full backup, also back up bucket files from `expense_proofs`.

WITH export_lines AS (
    SELECT 1 AS ord, '-- SharePay data backup' AS sql_line
    UNION ALL
    SELECT 2, 'BEGIN;'

    UNION ALL
    SELECT 10, '-- projects'
    UNION ALL
    SELECT
        100 + row_number() OVER (ORDER BY p.created_at, p.id),
        format(
            'INSERT INTO public.projects (id, name, description, is_active, created_at) VALUES (%L, %L, %L, %s, %L);',
            p.id::text,
            p.name,
            p.description,
            CASE WHEN p.is_active THEN 'true' ELSE 'false' END,
            p.created_at::text
        )
    FROM public.projects p

    UNION ALL
    SELECT 1000, '-- profiles'
    UNION ALL
    SELECT
        1100 + row_number() OVER (ORDER BY p.created_at, p.id),
        format(
            'INSERT INTO public.profiles (id, display_name, created_at) VALUES (%L, %L, %L);',
            p.id::text,
            p.display_name,
            p.created_at::text
        )
    FROM public.profiles p

    UNION ALL
    SELECT 2000, '-- expenses'
    UNION ALL
    SELECT
        2100 + row_number() OVER (ORDER BY e.created_at, e.id),
        format(
            'INSERT INTO public.expenses (id, project_id, transaction_type, paid_by, amount, currency, paid_at, description, is_reimbursed, reimbursed_at, reimbursed_by, reimbursement_proof_url, proof_image_url, notes, created_at, category) VALUES (%L, %L, %L, %L, %s, %L, %L, %L, %s, %L, %L, %L, %L, %L, %L, %L);',
            e.id::text,
            e.project_id::text,
            e.transaction_type,
            e.paid_by::text,
            COALESCE(e.amount::text, 'NULL'),
            e.currency,
            e.paid_at::text,
            e.description,
            CASE WHEN e.is_reimbursed THEN 'true' ELSE 'false' END,
            e.reimbursed_at::text,
            e.reimbursed_by::text,
            e.reimbursement_proof_url,
            e.proof_image_url,
            e.notes,
            e.created_at::text,
            e.category
        )
    FROM public.expenses e

    UNION ALL
    SELECT 3000, '-- expense_attachments'
    UNION ALL
    SELECT
        3100 + row_number() OVER (ORDER BY a.created_at, a.id),
        format(
            'INSERT INTO public.expense_attachments (id, expense_id, file_url, file_type, created_at) VALUES (%L, %L, %L, %L, %L);',
            a.id::text,
            a.expense_id::text,
            a.file_url,
            a.file_type,
            a.created_at::text
        )
    FROM public.expense_attachments a

    UNION ALL
    SELECT 9000, 'COMMIT;'
)
SELECT sql_line
FROM export_lines
ORDER BY ord;
