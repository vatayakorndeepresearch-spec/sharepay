-- Add 'ส่วนตัว' (Personal) project if it doesn't exist
INSERT INTO projects (name, description)
VALUES ('ส่วนตัว', 'ค่าใช้จ่ายส่วนตัว')
ON CONFLICT DO NOTHING;
