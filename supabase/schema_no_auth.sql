-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. DROP EXISTING TABLES (Clean slate)
DROP TABLE IF EXISTS expenses;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS profiles;

-- 2. PROFILES (No auth reference)
CREATE TABLE profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. PROJECTS
CREATE TABLE projects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. EXPENSES
CREATE TABLE expenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  transaction_type TEXT DEFAULT 'expense' CHECK (transaction_type IN ('expense', 'income')),
  paid_by UUID REFERENCES profiles(id) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT DEFAULT 'THB',
  paid_at DATE NOT NULL,
  description TEXT NOT NULL,
  is_reimbursed BOOLEAN DEFAULT FALSE,
  reimbursed_at TIMESTAMP WITH TIME ZONE,
  reimbursed_by UUID REFERENCES profiles(id),
  reimbursement_proof_url TEXT,
  proof_image_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS POLICIES (Allow everything for anon)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to profiles" ON profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to projects" ON projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to expenses" ON expenses FOR ALL USING (true) WITH CHECK (true);

-- 4. STORAGE (Try to create bucket via SQL)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('expense_proofs', 'expense_proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policy
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'expense_proofs' );

CREATE POLICY "Public Upload"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'expense_proofs' );

-- 5. SEED DATA
INSERT INTO profiles (display_name) VALUES ('พี่'), ('น้อง');

INSERT INTO projects (name, description) VALUES 
('กองกลาง', 'ค่าใช้จ่ายส่วนกลาง เช่น ค่าอาหาร, ค่าของใช้'),
('BigLot', 'โปรเจค BigLot');
