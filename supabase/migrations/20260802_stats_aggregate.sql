-- Stats page used to pull every expense row in range and sum them in JS, so both the
-- payload and the load time grew linearly with the data. Aggregate in Postgres instead
-- and return a fixed-size document; the page keeps only presentation work.
--
-- Month keys are formatted in the database session timezone (UTC on Supabase), which is
-- what the previous JS bucketing produced on the UTC app server. Ordering stays in JS so
-- the Thai locale comparator keeps behaving exactly as before.

CREATE INDEX IF NOT EXISTS expenses_expense_paid_at_idx
    ON public.expenses (paid_at)
    WHERE transaction_type = 'expense';

DROP FUNCTION IF EXISTS public.get_expense_stats(uuid, timestamptz);

CREATE OR REPLACE FUNCTION public.get_expense_stats(
    p_project_id uuid DEFAULT NULL,
    p_start timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
    WITH base AS (
        SELECT
            e.amount::numeric AS amount,
            COALESCE(NULLIF(TRIM(e.category), ''), 'ไม่ระบุหมวดหมู่') AS category,
            e.paid_at,
            e.paid_by
        FROM public.expenses e
        WHERE e.transaction_type = 'expense'
          AND (p_project_id IS NULL OR e.project_id = p_project_id)
          AND (p_start IS NULL OR e.paid_at >= p_start)
    ),
    monthly AS (
        SELECT to_char(b.paid_at, 'YYYY-MM') AS month, SUM(b.amount)::numeric AS value
        FROM base b
        GROUP BY 1
    ),
    by_category AS (
        SELECT b.category AS label, SUM(b.amount)::numeric AS value
        FROM base b
        GROUP BY 1
    ),
    by_spender AS (
        SELECT
            COALESCE(p.display_name, 'Unknown') AS label,
            SUM(b.amount)::numeric AS value,
            COUNT(*)::integer AS count
        FROM base b
        LEFT JOIN public.profiles p ON p.id = b.paid_by
        GROUP BY 1
    )
    SELECT jsonb_build_object(
        'total', COALESCE((SELECT SUM(amount) FROM base), 0),
        'count', (SELECT COUNT(*) FROM base),
        'earliest', (SELECT MIN(paid_at) FROM base),
        'monthly', COALESCE(
            (SELECT jsonb_agg(jsonb_build_object('month', m.month, 'value', m.value) ORDER BY m.month) FROM monthly m),
            '[]'::jsonb
        ),
        'by_category', COALESCE(
            (SELECT jsonb_agg(jsonb_build_object('label', c.label, 'value', c.value)) FROM by_category c),
            '[]'::jsonb
        ),
        'by_spender', COALESCE(
            (SELECT jsonb_agg(jsonb_build_object('label', s.label, 'value', s.value, 'count', s.count)) FROM by_spender s),
            '[]'::jsonb
        )
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_expense_stats(uuid, timestamptz) TO anon, authenticated, service_role;
