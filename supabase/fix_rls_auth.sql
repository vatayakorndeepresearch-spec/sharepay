-- Fix RLS Policies: Require authentication for all data access
-- Run this in Supabase SQL Editor after enabling auth
-- This replaces the permissive "allow all" policies with authenticated-only access

-- ============================================
-- 1. Drop ALL existing permissive policies
-- ============================================

-- Profiles
DROP POLICY IF EXISTS "Allow all access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Projects
DROP POLICY IF EXISTS "Allow all access to projects" ON public.projects;
DROP POLICY IF EXISTS "Enable all access for authenticated users to projects" ON public.projects;

-- Expenses
DROP POLICY IF EXISTS "Allow all access to expenses" ON public.expenses;
DROP POLICY IF EXISTS "Enable all access for authenticated users to expenses" ON public.expenses;

-- Attachments
DROP POLICY IF EXISTS "Enable all access for authenticated users to attachments" ON public.expense_attachments;

-- Storage
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload" ON storage.objects;

-- ============================================
-- 2. Enable RLS on all tables
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_attachments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. Create new authenticated-only policies
-- ============================================

-- Profiles: All authenticated users can read, users can only update their own
CREATE POLICY "Authenticated users can view all profiles"
ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Auto-create profile on signup"
ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Projects: Authenticated users have full access (shared app)
CREATE POLICY "Authenticated users can manage projects"
ON public.projects FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Expenses: Authenticated users have full access (shared app)
CREATE POLICY "Authenticated users can manage expenses"
ON public.expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Attachments: Authenticated users have full access (shared app)
CREATE POLICY "Authenticated users can manage attachments"
ON public.expense_attachments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 4. Storage policies - authenticated only
-- ============================================

-- Make bucket private
UPDATE storage.buckets SET public = false WHERE id = 'expense_proofs';

-- Authenticated users can view files
CREATE POLICY "Authenticated users can view expense proofs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'expense_proofs');

-- Authenticated users can upload files (images only, max 5MB)
CREATE POLICY "Authenticated users can upload expense proofs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'expense_proofs'
    AND (storage.foldername(name))[1] IN ('uploads', 'reimbursements')
);

-- Authenticated users can delete their uploads
CREATE POLICY "Authenticated users can delete expense proofs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'expense_proofs');
