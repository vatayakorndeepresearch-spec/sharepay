-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.expense_attachments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  expense_id uuid NOT NULL,
  file_url text NOT NULL,
  file_type text DEFAULT 'image'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT expense_attachments_pkey PRIMARY KEY (id),
  CONSTRAINT expense_attachments_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES public.expenses(id)
);

CREATE TABLE public.expenses (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  project_id uuid NOT NULL,
  transaction_type text DEFAULT 'expense'::text CHECK (transaction_type = ANY (ARRAY['expense'::text, 'income'::text])),
  paid_by uuid NOT NULL,
  amount numeric NOT NULL,
  currency text DEFAULT 'THB'::text,
  paid_at date NOT NULL,
  description text NOT NULL,
  is_reimbursed boolean DEFAULT false,
  reimbursed_at timestamp with time zone,
  reimbursed_by uuid,
  reimbursement_proof_url text,
  proof_image_url text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  category text DEFAULT 'Others'::text,
  CONSTRAINT expenses_pkey PRIMARY KEY (id),
  CONSTRAINT expenses_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT expenses_paid_by_fkey FOREIGN KEY (paid_by) REFERENCES public.profiles(id),
  CONSTRAINT expenses_reimbursed_by_fkey FOREIGN KEY (reimbursed_by) REFERENCES public.profiles(id)
);

CREATE TABLE public.profiles (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  display_name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id)
);

CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT projects_pkey PRIMARY KEY (id)
);
