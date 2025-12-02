-- 1. Create Trigger to automatically create profile on signup
-- This is crucial for Google Login to work smoothly.

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to avoid errors
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_attachments ENABLE ROW LEVEL SECURITY;

-- 3. Create Policies (Basic policies for a shared app)

-- Profiles: Everyone can read, User can update own
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Projects: Authenticated users can read/write
DROP POLICY IF EXISTS "Enable all access for authenticated users to projects" ON public.projects;
CREATE POLICY "Enable all access for authenticated users to projects"
ON public.projects FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Expenses: Authenticated users can read/write
DROP POLICY IF EXISTS "Enable all access for authenticated users to expenses" ON public.expenses;
CREATE POLICY "Enable all access for authenticated users to expenses"
ON public.expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Attachments: Authenticated users can read/write
DROP POLICY IF EXISTS "Enable all access for authenticated users to attachments" ON public.expense_attachments;
CREATE POLICY "Enable all access for authenticated users to attachments"
ON public.expense_attachments FOR ALL TO authenticated USING (true) WITH CHECK (true);
