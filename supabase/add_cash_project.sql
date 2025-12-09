-- Add 'Cash' project if it doesn't exist
INSERT INTO projects (name, description)
VALUES ('Cash', 'Cash Project')
ON CONFLICT DO NOTHING;
