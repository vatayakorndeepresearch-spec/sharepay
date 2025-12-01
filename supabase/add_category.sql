-- Add category column to expenses table
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Others';

-- Optional: Update existing rows to have 'Others' if null (though default handles new ones)
UPDATE expenses SET category = 'Others' WHERE category IS NULL;
