-- ============================================================
-- 1. get_project_financial_summary
-- หน้าแรก: สรุปรายรับ/รายจ่ายแยกตามโปรเจค
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_project_financial_summary()
RETURNS TABLE (
    project_id uuid,
    project_name text,
    income_total numeric,
    expense_total numeric
) LANGUAGE sql STABLE AS $$
    SELECT
        p.id AS project_id,
        p.name AS project_name,
        COALESCE(SUM(CASE WHEN e.transaction_type = 'income' THEN e.amount END), 0) AS income_total,
        COALESCE(SUM(CASE WHEN e.transaction_type = 'expense' THEN e.amount END), 0) AS expense_total
    FROM public.projects p
    LEFT JOIN public.expenses e ON e.project_id = p.id
    WHERE p.is_active = true
    GROUP BY p.id, p.name
    ORDER BY p.name;
$$;

-- ============================================================
-- 2. get_settlement_summary
-- หน้าแรก: สรุปยอดค้างระหว่าง 2 คน
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_settlement_summary(p_current_profile_id uuid)
RETURNS TABLE (
    state text,
    amount numeric,
    other_party_name text,
    unpaid_count bigint
) LANGUAGE sql STABLE AS $$
    WITH unpaid AS (
        SELECT paid_by, amount
        FROM public.expenses
        WHERE is_reimbursed = false
          AND transaction_type = 'expense'
    ),
    other_profile AS (
        SELECT id, display_name
        FROM public.profiles
        WHERE id != p_current_profile_id
        LIMIT 1
    ),
    totals AS (
        SELECT
            COALESCE(SUM(CASE WHEN paid_by = p_current_profile_id THEN amount END), 0) AS my_total,
            COALESCE(SUM(CASE WHEN paid_by != p_current_profile_id THEN amount END), 0) AS other_total,
            COUNT(*) AS cnt
        FROM unpaid
    )
    SELECT
        CASE
            WHEN t.my_total > t.other_total THEN 'owed_to_you'
            WHEN t.my_total < t.other_total THEN 'you_owe'
            ELSE 'clear'
        END AS state,
        ABS(t.my_total - t.other_total) / 2 AS amount,
        op.display_name AS other_party_name,
        t.cnt AS unpaid_count
    FROM totals t
    CROSS JOIN other_profile op;
$$;

-- ============================================================
-- 3. get_stats_summary
-- หน้า Stats: กราฟหมวดหมู่, กราฟรายเดือน, top spender/category
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_stats_summary(p_project_id uuid DEFAULT NULL)
RETURNS TABLE (
    category_labels text[],
    category_values numeric[],
    monthly_months text[],
    monthly_values numeric[],
    top_spender_name text,
    top_spender_amount numeric,
    top_category_name text,
    top_category_amount numeric,
    total_expense numeric,
    this_month_expense numeric
) LANGUAGE sql STABLE AS $$
    WITH filtered AS (
        SELECT e.*, p.display_name AS spender_name
        FROM public.expenses e
        JOIN public.profiles p ON p.id = e.paid_by
        WHERE e.transaction_type = 'expense'
          AND (p_project_id IS NULL OR e.project_id = p_project_id)
    ),
    cat_agg AS (
        SELECT category, SUM(amount) AS total
        FROM filtered
        GROUP BY category
        ORDER BY total DESC
        LIMIT 6
    ),
    monthly_agg AS (
        SELECT to_char(paid_at, 'YYYY-MM') AS month, SUM(amount) AS total
        FROM filtered
        WHERE paid_at >= (CURRENT_DATE - INTERVAL '5 months')
        GROUP BY month
        ORDER BY month
    ),
    top_spender AS (
        SELECT spender_name, SUM(amount) AS total
        FROM filtered
        GROUP BY spender_name
        ORDER BY total DESC
        LIMIT 1
    ),
    top_cat AS (
        SELECT category, SUM(amount) AS total
        FROM filtered
        GROUP BY category
        ORDER BY total DESC
        LIMIT 1
    )
    SELECT
        ARRAY(SELECT category FROM cat_agg),
        ARRAY(SELECT total FROM cat_agg),
        ARRAY(SELECT month FROM monthly_agg),
        ARRAY(SELECT total FROM monthly_agg),
        (SELECT spender_name FROM top_spender),
        (SELECT total FROM top_spender),
        (SELECT category FROM top_cat),
        (SELECT total FROM top_cat),
        COALESCE((SELECT SUM(amount) FROM filtered), 0),
        COALESCE((SELECT SUM(amount) FROM filtered WHERE paid_at >= date_trunc('month', CURRENT_DATE)), 0);
$$;

-- ============================================================
-- 4. get_expense_list_summary
-- หน้า Expenses: นับจำนวน/ยอดรวมตาม filter
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_expense_list_summary(
    p_project_id uuid DEFAULT NULL,
    p_status text DEFAULT 'all',
    p_type text DEFAULT 'all'
)
RETURNS TABLE (
    all_count bigint,
    unpaid_count bigint,
    paid_count bigint,
    income_count bigint,
    expense_count bigint,
    filtered_count bigint,
    filtered_amount numeric
) LANGUAGE sql STABLE AS $$
    WITH scoped AS (
        SELECT *
        FROM public.expenses
        WHERE (p_project_id IS NULL OR project_id = p_project_id)
    ),
    filtered AS (
        SELECT *
        FROM scoped
        WHERE (p_type = 'all' OR transaction_type = p_type)
          AND (
            p_status = 'all'
            OR (p_status = 'unpaid' AND is_reimbursed = false)
            OR (p_status = 'paid' AND is_reimbursed = true)
          )
    )
    SELECT
        (SELECT COUNT(*) FROM scoped),
        (SELECT COUNT(*) FROM scoped WHERE is_reimbursed = false),
        (SELECT COUNT(*) FROM scoped WHERE is_reimbursed = true),
        (SELECT COUNT(*) FROM scoped WHERE transaction_type = 'income'),
        (SELECT COUNT(*) FROM scoped WHERE transaction_type = 'expense'),
        (SELECT COUNT(*) FROM filtered),
        COALESCE((SELECT SUM(amount) FROM filtered), 0);
$$;
