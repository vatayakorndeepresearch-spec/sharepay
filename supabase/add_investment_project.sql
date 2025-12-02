-- Add 'ลงทุน' (Investment) project if it doesn't exist
INSERT INTO projects (name, description)
VALUES ('ลงทุน', 'พอร์ตการลงทุน')
ON CONFLICT DO NOTHING;
