-- Slip extraction audit log: one row per AI/OCR read of a slip image.
-- Doubles as the dedupe index (trans_ref from the slip mini-QR) and as a
-- free-flowing evaluation set for the extraction pipeline.

create table if not exists public.slip_extractions (
    id uuid primary key default gen_random_uuid(),
    expense_id uuid references public.expenses(id) on delete cascade,
    storage_path text not null,
    provider text not null,                  -- 'typhoon' | 'openrouter' | 'tesseract-fallback'
    model text,
    extraction jsonb not null,               -- full SlipExtraction object
    trans_ref text,
    bank text,
    confidence text,
    created_at timestamptz not null default now(),
    created_by uuid references auth.users(id) default auth.uid()
);

create index if not exists slip_extractions_trans_ref_idx
    on public.slip_extractions (trans_ref)
    where trans_ref is not null;

create index if not exists slip_extractions_expense_id_idx
    on public.slip_extractions (expense_id);

alter table public.slip_extractions enable row level security;

-- Visibility mirrors public.expenses: this is a shared household app, so every
-- authenticated user has full access (see supabase/fix_rls_auth.sql).
drop policy if exists "Authenticated users can manage slip extractions" on public.slip_extractions;
create policy "Authenticated users can manage slip extractions"
    on public.slip_extractions for all to authenticated using (true) with check (true);
