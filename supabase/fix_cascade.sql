-- Drop the existing constraint (if it exists without cascade)
ALTER TABLE expense_attachments
DROP CONSTRAINT IF EXISTS expense_attachments_expense_id_fkey;

-- Add the constraint again with ON DELETE CASCADE
ALTER TABLE expense_attachments
ADD CONSTRAINT expense_attachments_expense_id_fkey
FOREIGN KEY (expense_id)
REFERENCES expenses(id)
ON DELETE CASCADE;
