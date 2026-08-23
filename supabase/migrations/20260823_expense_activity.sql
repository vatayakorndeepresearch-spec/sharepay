-- Activity log: one row per action taken on an expense (create / edit / clear /
-- unclear / delete). Powers the "ความเคลื่อนไหวล่าสุด" feed and the undo button
-- on settlement changes.
--
-- expense_id is nulled (not cascaded away) when the expense is deleted, so the
-- delete event itself survives in the feed; `snapshot` keeps enough of the row
-- to render it afterwards.

create table if not exists public.expense_activity (
    id uuid primary key default gen_random_uuid(),
    expense_id uuid references public.expenses(id) on delete set null,
    action text not null check (
        action in ('create', 'update', 'reimburse', 'unreimburse', 'delete')
    ),
    actor_id uuid references auth.users(id) on delete set null default auth.uid(),
    actor_name text,
    -- description / amount / transaction_type / project_name, plus `previous`
    -- settlement fields on unreimburse so the action can be undone.
    snapshot jsonb not null default '{}'::jsonb,
    -- Set when this event has been rolled back, so undo can only run once.
    undone_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists expense_activity_created_at_idx
    on public.expense_activity (created_at desc);

create index if not exists expense_activity_expense_id_idx
    on public.expense_activity (expense_id);

alter table public.expense_activity enable row level security;

-- Visibility mirrors public.expenses: this is a shared household app, so every
-- authenticated user has full access (see supabase/fix_rls_auth.sql).
drop policy if exists "Authenticated users can manage expense activity" on public.expense_activity;
create policy "Authenticated users can manage expense activity"
    on public.expense_activity for all to authenticated using (true) with check (true);
