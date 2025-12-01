-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. PROJECTS
CREATE TABLE projects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. EXPENSES
CREATE TABLE expenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  paid_by UUID REFERENCES profiles(id) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT DEFAULT 'THB',
  paid_at DATE NOT NULL,
  description TEXT NOT NULL,
  is_reimbursed BOOLEAN DEFAULT FALSE,
  reimbursed_at TIMESTAMP WITH TIME ZONE,
  reimbursed_by UUID REFERENCES profiles(id),
  proof_image_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS POLICIES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Profiles: Everyone can read, User can update own
CREATE POLICY "Public profiles are viewable by everyone" 
ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE USING (auth.uid() = id);

-- Projects: Everyone can read/write (Simple family app)
CREATE POLICY "Enable all access for authenticated users to projects"
ON projects FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Expenses: Everyone can read/write
CREATE POLICY "Enable all access for authenticated users to expenses"
ON expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- STORAGE BUCKET
-- Note: You need to create the bucket 'expense_proofs' in the dashboard manually or via API if not exists.
-- Policy for storage will be set in dashboard usually, but here is the idea:
-- Give authenticated users access to upload and read.

-- SEED DATA
-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (new.id, new.email, split_part(new.email, '@', 1));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Default Projects
INSERT INTO projects (name, description) VALUES 
('กองกลาง', 'ค่าใช้จ่ายส่วนกลาง เช่น ค่าอาหาร, ค่าของใช้'),
('BigLot', 'โปรเจค BigLot');
