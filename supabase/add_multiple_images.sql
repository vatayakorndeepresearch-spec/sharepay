-- Create expense_attachments table
CREATE TABLE IF NOT EXISTS expense_attachments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT DEFAULT 'image',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE expense_attachments ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read/write (since we are in no-auth mode)
CREATE POLICY "Enable all access for everyone to expense_attachments" ON expense_attachments FOR ALL USING (true) WITH CHECK (true);
