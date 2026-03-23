CREATE INDEX IF NOT EXISTS expenses_paid_at_desc_idx
    ON public.expenses (paid_at DESC);

CREATE INDEX IF NOT EXISTS expenses_project_paid_at_desc_idx
    ON public.expenses (project_id, paid_at DESC);

CREATE INDEX IF NOT EXISTS expenses_transaction_type_paid_at_desc_idx
    ON public.expenses (transaction_type, paid_at DESC);

CREATE INDEX IF NOT EXISTS expenses_project_transaction_type_paid_at_desc_idx
    ON public.expenses (project_id, transaction_type, paid_at DESC);

CREATE INDEX IF NOT EXISTS expenses_expense_status_paid_at_desc_idx
    ON public.expenses (is_reimbursed, paid_at DESC)
    WHERE transaction_type = 'expense';

CREATE INDEX IF NOT EXISTS expenses_project_expense_status_paid_at_desc_idx
    ON public.expenses (project_id, is_reimbursed, paid_at DESC)
    WHERE transaction_type = 'expense';

CREATE INDEX IF NOT EXISTS expenses_unpaid_paid_by_idx
    ON public.expenses (paid_by)
    WHERE transaction_type = 'expense' AND is_reimbursed = false;

CREATE INDEX IF NOT EXISTS expense_attachments_expense_id_idx
    ON public.expense_attachments (expense_id);

CREATE INDEX IF NOT EXISTS projects_is_active_name_idx
    ON public.projects (is_active, name);

DROP FUNCTION IF EXISTS public.get_project_financial_summary();

CREATE OR REPLACE FUNCTION public.get_project_financial_summary()
RETURNS TABLE (
    project_id uuid,
    project_name text,
    income_total numeric,
    expense_total numeric
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        p.id AS project_id,
        p.name AS project_name,
        COALESCE(SUM(e.amount) FILTER (WHERE e.transaction_type = 'income'), 0)::numeric AS income_total,
        COALESCE(SUM(e.amount) FILTER (WHERE e.transaction_type = 'expense'), 0)::numeric AS expense_total
    FROM public.projects p
    LEFT JOIN public.expenses e ON e.project_id = p.id
    WHERE p.is_active = true
    GROUP BY p.id, p.name
    ORDER BY p.name;
$$;

DROP FUNCTION IF EXISTS public.get_settlement_summary(uuid);

CREATE OR REPLACE FUNCTION public.get_settlement_summary(p_current_profile_id uuid)
RETURNS TABLE (
    state text,
    amount numeric,
    other_party_name text,
    unpaid_count integer
)
LANGUAGE sql
STABLE
AS $$
    WITH selected_profiles AS (
        SELECT p.id, p.display_name
        FROM public.profiles p
        ORDER BY p.created_at ASC, p.id ASC
        LIMIT 2
    ),
    current_profile AS (
        SELECT sp.id
        FROM selected_profiles sp
        WHERE sp.id = p_current_profile_id
    ),
    other_profile AS (
        SELECT sp.id, sp.display_name
        FROM selected_profiles sp
        WHERE sp.id <> p_current_profile_id
        LIMIT 1
    ),
    unpaid_totals AS (
        SELECT e.paid_by, COALESCE(SUM(e.amount), 0)::numeric AS total_amount
        FROM public.expenses e
        WHERE e.transaction_type = 'expense' AND e.is_reimbursed = false
        GROUP BY e.paid_by
    ),
    unpaid_summary AS (
        SELECT COUNT(*)::integer AS unpaid_count
        FROM public.expenses e
        WHERE e.transaction_type = 'expense' AND e.is_reimbursed = false
    ),
    totals AS (
        SELECT
            COALESCE(
                (
                    SELECT ut.total_amount
                    FROM unpaid_totals ut
                    JOIN current_profile cp ON cp.id = ut.paid_by
                ),
                0
            )::numeric AS current_paid,
            COALESCE(
                (
                    SELECT ut.total_amount
                    FROM unpaid_totals ut
                    JOIN other_profile op ON op.id = ut.paid_by
                ),
                0
            )::numeric AS other_paid,
            (SELECT op.display_name FROM other_profile op) AS other_party_name,
            EXISTS(SELECT 1 FROM current_profile) AS has_current,
            EXISTS(SELECT 1 FROM other_profile) AS has_other
    )
    SELECT
        CASE
            WHEN NOT t.has_current OR NOT t.has_other THEN 'unknown'
            WHEN t.current_paid > t.other_paid THEN 'owed_to_you'
            WHEN t.current_paid < t.other_paid THEN 'you_owe'
            ELSE 'clear'
        END AS state,
        CASE
            WHEN NOT t.has_current OR NOT t.has_other THEN 0::numeric
            ELSE ABS(t.current_paid - t.other_paid)::numeric
        END AS amount,
        t.other_party_name,
        us.unpaid_count
    FROM totals t
    CROSS JOIN unpaid_summary us;
$$;

DROP FUNCTION IF EXISTS public.get_expense_list_summary(uuid, text, text);
DROP FUNCTION IF EXISTS public.get_expense_list_summary(uuid, text, text, text);

CREATE OR REPLACE FUNCTION public.get_expense_list_summary(
    p_project_id uuid DEFAULT NULL,
    p_status text DEFAULT 'all',
    p_type text DEFAULT 'all',
    p_month text DEFAULT 'all'
)
RETURNS TABLE (
    all_count integer,
    unpaid_count integer,
    paid_count integer,
    income_count integer,
    expense_count integer,
    filtered_count integer,
    filtered_amount numeric
)
LANGUAGE sql
STABLE
AS $$
    WITH scoped AS (
        SELECT e.transaction_type, e.is_reimbursed, e.amount
        FROM public.expenses e
        WHERE (p_project_id IS NULL OR e.project_id = p_project_id)
          AND (p_month = 'all' OR to_char(e.paid_at, 'YYYY-MM') = p_month)
    ),
    filtered AS (
        SELECT s.amount
        FROM scoped s
        WHERE (p_type = 'all' OR s.transaction_type = p_type)
          AND (
              p_status = 'all'
              OR (p_status = 'unpaid' AND s.is_reimbursed = false)
              OR (p_status = 'paid' AND s.is_reimbursed = true)
          )
    )
    SELECT
        COUNT(*)::integer AS all_count,
        COUNT(*) FILTER (WHERE transaction_type = 'expense' AND is_reimbursed = false)::integer AS unpaid_count,
        COUNT(*) FILTER (WHERE transaction_type = 'expense' AND is_reimbursed = true)::integer AS paid_count,
        COUNT(*) FILTER (WHERE transaction_type = 'income')::integer AS income_count,
        COUNT(*) FILTER (WHERE transaction_type = 'expense')::integer AS expense_count,
        COALESCE((SELECT COUNT(*)::integer FROM filtered), 0) AS filtered_count,
        COALESCE((SELECT SUM(amount)::numeric FROM filtered), 0)::numeric AS filtered_amount
    FROM scoped;
$$;

DROP FUNCTION IF EXISTS public.get_stats_summary(uuid);

CREATE OR REPLACE FUNCTION public.get_stats_summary(p_project_id uuid DEFAULT NULL)
RETURNS TABLE (
    category_labels text[],
    category_values numeric[],
    monthly_months date[],
    monthly_values numeric[],
    top_spender_name text,
    top_spender_amount numeric,
    top_category_name text,
    top_category_amount numeric,
    total_expense numeric,
    this_month_expense numeric
)
LANGUAGE sql
STABLE
AS $$
    WITH filtered_expenses AS (
        SELECT
            e.amount::numeric AS amount,
            COALESCE(NULLIF(TRIM(e.category), ''), 'ไม่ระบุหมวดหมู่') AS category,
            e.paid_at,
            e.paid_by
        FROM public.expenses e
        WHERE e.transaction_type = 'expense'
          AND (p_project_id IS NULL OR e.project_id = p_project_id)
    ),
    category_totals AS (
        SELECT fe.category, SUM(fe.amount)::numeric AS amount
        FROM filtered_expenses fe
        GROUP BY fe.category
    ),
    category_agg AS (
        SELECT
            COALESCE(ARRAY_AGG(ct.category ORDER BY ct.amount DESC, ct.category), ARRAY[]::text[]) AS labels,
            COALESCE(ARRAY_AGG(ct.amount ORDER BY ct.amount DESC, ct.category), ARRAY[]::numeric[]) AS values
        FROM category_totals ct
    ),
    monthly_totals AS (
        SELECT DATE_TRUNC('month', fe.paid_at)::date AS month_start, SUM(fe.amount)::numeric AS amount
        FROM filtered_expenses fe
        GROUP BY DATE_TRUNC('month', fe.paid_at)::date
    ),
    monthly_agg AS (
        SELECT
            COALESCE(ARRAY_AGG(mt.month_start ORDER BY mt.month_start), ARRAY[]::date[]) AS months,
            COALESCE(ARRAY_AGG(mt.amount ORDER BY mt.month_start), ARRAY[]::numeric[]) AS values
        FROM monthly_totals mt
    ),
    spender_totals AS (
        SELECT COALESCE(p.display_name, 'Unknown') AS display_name, SUM(fe.amount)::numeric AS amount
        FROM filtered_expenses fe
        LEFT JOIN public.profiles p ON p.id = fe.paid_by
        GROUP BY COALESCE(p.display_name, 'Unknown')
    ),
    top_spender AS (
        SELECT st.display_name, st.amount
        FROM spender_totals st
        ORDER BY st.amount DESC, st.display_name
        LIMIT 1
    ),
    top_category AS (
        SELECT ct.category, ct.amount
        FROM category_totals ct
        ORDER BY ct.amount DESC, ct.category
        LIMIT 1
    ),
    summary AS (
        SELECT
            COALESCE(SUM(fe.amount), 0)::numeric AS total_expense,
            COALESCE(
                SUM(fe.amount) FILTER (
                    WHERE DATE_TRUNC('month', fe.paid_at) = DATE_TRUNC('month', CURRENT_DATE)
                ),
                0
            )::numeric AS this_month_expense
        FROM filtered_expenses fe
    )
    SELECT
        ca.labels AS category_labels,
        ca.values AS category_values,
        ma.months AS monthly_months,
        ma.values AS monthly_values,
        COALESCE(ts.display_name, '-') AS top_spender_name,
        COALESCE(ts.amount, 0)::numeric AS top_spender_amount,
        COALESCE(tc.category, '-') AS top_category_name,
        COALESCE(tc.amount, 0)::numeric AS top_category_amount,
        s.total_expense,
        s.this_month_expense
    FROM category_agg ca
    CROSS JOIN monthly_agg ma
    CROSS JOIN summary s
    LEFT JOIN top_spender ts ON true
    LEFT JOIN top_category tc ON true;
$$;

GRANT EXECUTE ON FUNCTION public.get_project_financial_summary() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_settlement_summary(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_expense_list_summary(uuid, text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_stats_summary(uuid) TO anon, authenticated, service_role;
