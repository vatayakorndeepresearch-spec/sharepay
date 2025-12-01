-- 1. Ensure Projects Exist
INSERT INTO projects (name, description) VALUES 
('BigLot', 'Project BigLot'), 
('กองกลาง', 'ค่าใช้จ่ายกองกลาง')
ON CONFLICT DO NOTHING;

-- 2. Insert Expenses
WITH 
  p_iphone AS (SELECT id FROM profiles WHERE display_name = 'พี่' LIMIT 1),
  p_pin AS (SELECT id FROM profiles WHERE display_name = 'น้อง' LIMIT 1),
  proj_biglot AS (SELECT id FROM projects WHERE name = 'BigLot' LIMIT 1),
  proj_central AS (SELECT id FROM projects WHERE name = 'กองกลาง' LIMIT 1)

INSERT INTO expenses (
  paid_at, 
  paid_by, 
  transaction_type, 
  project_id, 
  description, 
  amount, 
  is_reimbursed, 
  reimbursed_at, 
  reimbursed_by, 
  proof_image_url, 
  reimbursement_proof_url
)
VALUES
-- 1. 2025-11-02 Pin BigLot 562
('2025-11-02T07:39:50+07:00', (SELECT id FROM p_pin), 'expense', (SELECT id FROM proj_biglot), 'ค่าอาหาร', 562, true, '2025-11-02T07:39:46+07:00', (SELECT id FROM p_iphone), 'https://drive.google.com/file/d/1p70mFyYVB12O0qsq-kTJtcqM3Q3dSCoQ/view?usp=drivesdk', 'https://drive.google.com/file/d/1sW7ZJamy3Dxj89ZGefpyJqhalriBfqj-/view?usp=drivesdk'),

-- 2. 2025-11-02 Pin BigLot 61
('2025-11-02T07:42:22+07:00', (SELECT id FROM p_pin), 'expense', (SELECT id FROM proj_biglot), 'ค่ารถเดินทางกลับ', 61, true, '2025-11-02T07:42:19+07:00', (SELECT id FROM p_iphone), 'https://drive.google.com/file/d/1BKdBMBtMjnKToxaUW7_4azxG2w5UD_FE/view?usp=drivesdk', 'https://drive.google.com/file/d/1feMrXT-xhgUhQKsq8xxHyYUyLVb2wlIK/view?usp=drivesdk'),

-- 3. 2025-11-02 iPhone BigLot 100
('2025-11-02T16:13:50+07:00', (SELECT id FROM p_iphone), 'expense', (SELECT id FROM proj_biglot), 'ทดสอบ', 100, true, '2025-11-02T16:13:46+07:00', (SELECT id FROM p_iphone), 'https://drive.google.com/file/d/1scmaCNGxK9UjfQhE8N5CWUvFjAlXPk89/view?usp=drivesdk', 'https://drive.google.com/file/d/1d-CKqYpmMfPAKcx48hT2EDs8nHkAGi5N/view?usp=drivesdk'),

-- 4. 2025-11-02 iPhone BigLot 21,950.00
('2025-11-02T19:48:46+07:00', (SELECT id FROM p_iphone), 'expense', (SELECT id FROM proj_biglot), 'LandmarkForum Sinlapin', 21950.00, true, '2025-11-02T19:48:42+07:00', (SELECT id FROM p_iphone), 'https://drive.google.com/file/d/1xwOQ3BOKdciMbH_J3fMlCyJrATI4YauE/view?usp=drivesdk', 'https://drive.google.com/file/d/1GtHV10j41UNEKHSOpr4hVPHLoYWFjwc4/view?usp=drivesdk'),

-- 5. 2025-11-03 Pin BigLot 162
('2025-11-03T15:58:52+07:00', (SELECT id FROM p_pin), 'expense', (SELECT id FROM proj_biglot), 'ค่าหลอดไฟ (สลิปนั้นรวมสายกีตาร์)', 162, true, '2025-11-03T15:58:47+07:00', (SELECT id FROM p_iphone), 'https://drive.google.com/file/d/19rXHGwSDTX1XycgiFSNyxh8mTvVuZaBh/view?usp=drivesdk', 'https://drive.google.com/file/d/1FoQuOsZxHiz5dynQFAdhw4xvBuja1Z_h/view?usp=drivesdk'),

-- 6. 2025-11-04 iPhone BigLot 2,380.71
('2025-11-04T20:11:52+07:00', (SELECT id FROM p_iphone), 'expense', (SELECT id FROM proj_biglot), 'ซื้อเครื่องมือ aba', 2380.71, true, '2025-11-04T20:11:48+07:00', (SELECT id FROM p_iphone), 'https://drive.google.com/file/d/1AynTn43ALegRVB18kuF9gqkPPwpUDiiX/view?usp=drivesdk', 'https://drive.google.com/file/d/1Eq3OU32J2n254d4gJ1ckeAnVbrg3r55Y/view?usp=drivesdk'),

-- 7. 2025-11-05 Pin BigLot 330
('2025-11-05T23:52:10+07:00', (SELECT id FROM p_pin), 'expense', (SELECT id FROM proj_biglot), 'จ่ายเพื่อรับเครื่องมือ', 330, true, '2025-11-05T23:52:05+07:00', (SELECT id FROM p_iphone), 'https://drive.google.com/file/d/1Kq5CbcRvovfviKWl4aQ48MBhRtwKPpvQ/view?usp=drivesdk', 'https://drive.google.com/file/d/1sWtPJPNgp-nV6RYY3hIMpWpGvCfW1JRH/view?usp=drivesdk'),

-- 8. 2025-11-06 Pin BigLot 549
('2025-11-06T17:06:57+07:00', (SELECT id FROM p_pin), 'expense', (SELECT id FROM proj_biglot), 'ค่าสมัครอินเคเตอร์', 549, true, '2025-11-06T17:06:52+07:00', (SELECT id FROM p_iphone), 'https://drive.google.com/file/d/1axama55jR-hwG57ghRKtcck_A6FeHtxF/view?usp=drivesdk', 'https://drive.google.com/file/d/13klo6EEk9gWEPQmpvaYMdu0wo5VU3TiF/view?usp=drivesdk'),

-- 9. 2025-11-06 iPhone BigLot 166
('2025-11-06T19:43:51+07:00', (SELECT id FROM p_iphone), 'expense', (SELECT id FROM proj_biglot), 'Bolt ไป commu the street', 166, true, '2025-11-06T19:43:46+07:00', (SELECT id FROM p_iphone), 'https://drive.google.com/file/d/1Na__6w6BG3xy34g9vOMLClapcKyCOoYj/view?usp=drivesdk', 'https://drive.google.com/file/d/1f79kRnaagXkkXo6HV51chgObblaqrMcU/view?usp=drivesdk'),

-- 10. 2025-11-07 iPhone BigLot 310
('2025-11-07T01:09:00+07:00', (SELECT id FROM p_iphone), 'expense', (SELECT id FROM proj_biglot), 'ค่ากาแฟเข้าคอมมู', 310, true, '2025-11-07T01:08:56+07:00', (SELECT id FROM p_iphone), 'https://drive.google.com/file/d/1Yfq0GC0FJzHWgSL30fnxaJv-Tand_BIL/view?usp=drivesdk', 'https://drive.google.com/file/d/1fKGaOH1t0PjS36bJ4s-jPJ51V7XHvRYz/view?usp=drivesdk'),

-- 11. 2025-11-07 iPhone BigLot 91
('2025-11-07T01:10:20+07:00', (SELECT id FROM p_iphone), 'expense', (SELECT id FROM proj_biglot), 'ค่าแท็กซี่กลับบ้านจากคอมมู', 91, true, '2025-11-07T01:10:15+07:00', (SELECT id FROM p_iphone), 'https://drive.google.com/file/d/1ZkYSBc9abFNxQNTwsdTBDhxUDAOBu3XJ/view?usp=drivesdk', 'https://drive.google.com/file/d/1aSu7Jv5voFThpMKP2D2aCD6p068U9yU4/view?usp=drivesdk'),

-- 12. 2025-11-04 iPhone กองกลาง 24000
('2025-11-04T13:15:43+07:00', (SELECT id FROM p_iphone), 'expense', (SELECT id FROM proj_central), 'ค่าบ้านเช่าซื้อตรงแกรนด์โฮม', 24000, true, '2025-11-04T13:15:39+07:00', (SELECT id FROM p_iphone), 'https://drive.google.com/file/d/1nYbHxNAaC-Y2AbD0zRl2qiDMxGdEYWU9/view?usp=drivesdk', 'https://drive.google.com/file/d/1hbphS30h2O7VH6YQwvon3SBddLHmTpIZ/view?usp=drivesdk'),

-- 13. 2025-11-04 iPhone กองกลาง 2528.23
('2025-11-04T22:44:07+07:00', (SELECT id FROM p_iphone), 'expense', (SELECT id FROM proj_central), 'ค่าไฟเดือนตุลาคม 2568', 2528.23, true, '2025-11-04T22:44:02+07:00', (SELECT id FROM p_iphone), 'https://drive.google.com/file/d/11xzZ7rE53cBLBjpNQeCghYKowLsk5qkR/view?usp=drivesdk', 'https://drive.google.com/file/d/1ErD54a0ZOXxTitdvS4o1eYJMD0OhCyM6/view?usp=drivesdk'),

-- 14. 2025-11-05 Pin กองกลาง 100
('2025-11-05T18:02:39+07:00', (SELECT id FROM p_pin), 'expense', (SELECT id FROM proj_central), 'ค่าน้ำมัน', 100, true, '2025-11-05T18:02:35+07:00', (SELECT id FROM p_iphone), 'https://drive.google.com/file/d/1GG7RhMLv8TXoezuA2QOx7wH6aOboyxeq/view?usp=drivesdk', 'https://drive.google.com/file/d/1ReWk2fvBYdB1r8DKw9zL2-NFr92Y1Gk7/view?usp=drivesdk'),

-- 15. 2025-11-15 iPhone BigLot 26
('2025-11-15T14:05:12+07:00', (SELECT id FROM p_iphone), 'expense', (SELECT id FROM proj_biglot), 'ค่ารถเรียน landmark', 26, true, '2025-11-15T14:05:07+07:00', (SELECT id FROM p_iphone), 'https://drive.google.com/file/d/1smcOddZTLPiKy6zjzIr9AhO8vwTk9-m7/view?usp=drivesdk', 'https://drive.google.com/file/d/1ohxQPJ1AIUySAZ81HY3stoCwYhRW2_bI/view?usp=drivesdk'),

-- 16. 2025-11-15 iPhone BigLot 130
('2025-11-15T14:16:13+07:00', (SELECT id FROM p_iphone), 'expense', (SELECT id FROM proj_biglot), 'ค่าเดินทางไปเรียนแลนด์มาร์ก', 130, true, '2025-11-15T14:16:08+07:00', (SELECT id FROM p_iphone), 'https://drive.google.com/file/d/1u907LLcnRKa0X4FLiq--5E2DBch5_O7L/view?usp=drivesdk', 'https://drive.google.com/file/d/1E4Q6cqmQpUhdetEpscz8WV_gf8QRQvmd/view?usp=drivesdk'),

-- 17. 2025-11-15 iPhone BigLot 65
('2025-11-15T14:17:55+07:00', (SELECT id FROM p_iphone), 'expense', (SELECT id FROM proj_biglot), 'ค่าเดินทางไปเรียนแลนด์มาร์ก', 65, true, '2025-11-15T14:17:51+07:00', (SELECT id FROM p_iphone), 'https://drive.google.com/file/d/18s9NwcDcc3_R5F8MDKtsHsIIdLDN7YmC/view?usp=drivesdk', 'https://drive.google.com/file/d/1g705EmB8OnVK_DoT-eFRhazh0lFlC8IR/view?usp=drivesdk'),

-- 18. 2025-11-20 Pin BigLot 52
('2025-11-20T12:06:21+07:00', (SELECT id FROM p_pin), 'expense', (SELECT id FROM proj_biglot), 'ค่ารถ', 52, true, '2025-11-20T12:06:16+07:00', (SELECT id FROM p_iphone), 'https://drive.google.com/file/d/18pHsbGFGyQbEscNf7k09kBqgTU-3ln60/view?usp=drivesdk', 'https://drive.google.com/file/d/1MfWheJz1BKc1rrR3YkSBlgLOHzB-LrVt/view?usp=drivesdk'),

-- 19. 2025-11-20 Pin BigLot 23
('2025-11-20T12:06:28+07:00', (SELECT id FROM p_pin), 'expense', (SELECT id FROM proj_biglot), 'ค่ารถ ก่อนออกจากบ้าน', 23, true, '2025-11-20T12:06:24+07:00', (SELECT id FROM p_iphone), 'https://drive.google.com/file/d/1yHdY1n1UD1B_lwUZT04-DQ7bMgRUIlue/view?usp=drivesdk', 'https://drive.google.com/file/d/1HIDaIShltG8oCYTa19QJ2cweksKcwoqK/view?usp=drivesdk'),

-- 20. 2025-11-20 Pin BigLot 65
('2025-11-20T12:06:34+07:00', (SELECT id FROM p_pin), 'expense', (SELECT id FROM proj_biglot), 'ค่าเดินทางไปบีทีเอส', 65, true, '2025-11-20T12:06:31+07:00', (SELECT id FROM p_iphone), 'https://drive.google.com/file/d/1Qu9-7_ZrwRPM_bQU3FrM2UFKAlMcHC1Q/view?usp=drivesdk', 'https://drive.google.com/file/d/1DVUZl_MtqedteoZO8fwmD6m2J_Dl6Js_/view?usp=drivesdk'),

-- 21. 2025-11-20 Pin BigLot 28
('2025-11-20T12:06:41+07:00', (SELECT id FROM p_pin), 'expense', (SELECT id FROM proj_biglot), 'ค่ารถก่อนออกจากบ้าน', 28, true, '2025-11-20T12:06:37+07:00', (SELECT id FROM p_iphone), 'https://drive.google.com/file/d/161lIapTJZwCH3GZo7XAnwks3yMFCnjZv/view?usp=drivesdk', 'https://drive.google.com/file/d/1nkBBtYUvAU84Vfard6wSX14lmRuUKV9l/view?usp=drivesdk'),

-- 22. 2025-11-20 Pin BigLot 65
('2025-11-20T12:06:47+07:00', (SELECT id FROM p_pin), 'expense', (SELECT id FROM proj_biglot), 'ค่าbts', 65, true, '2025-11-20T12:06:43+07:00', (SELECT id FROM p_iphone), 'https://drive.google.com/file/d/1t6fhcpOIZ6YJ5rHsXq2SxXj_Gz9IkfpZ/view?usp=drivesdk', 'https://drive.google.com/file/d/1LZ6Nyuwa-C0s74Q9TalIqRJ9l9ADtPoK/view?usp=drivesdk'),

-- 23. 2025-11-24 iPhone กองกลาง 263.77
('2025-11-24T12:35:48+07:00', (SELECT id FROM p_iphone), 'expense', (SELECT id FROM proj_central), 'ค่าชาร์จรถ', 263.77, true, '2025-11-24T12:35:45+07:00', (SELECT id FROM p_iphone), 'https://drive.google.com/file/d/11aTFRsb53i9yhh01wkPlS96m786FyT-4/view?usp=drivesdk', 'https://drive.google.com/file/d/1Y3hyjqjRa8oQBEn3NBBeskilkGg0Cp8c/view?usp=drivesdk'),

-- 24. 2025-11-25 iPhone BigLot 4626.67
('2025-11-25T12:03:14+07:00', (SELECT id FROM p_iphone), 'expense', (SELECT id FROM proj_biglot), 'TradingView Essential', 4626.67, true, '2025-11-25T12:03:10+07:00', (SELECT id FROM p_iphone), 'https://drive.google.com/file/d/1ko4XBX7Q5lRTxedaoHeken_7NdGebrSe/view?usp=drivesdk', 'https://drive.google.com/file/d/1Gn9Bflg3o_Ssa8vOkHryab-lY_siZMOK/view?usp=drivesdk'),

-- 25. 2025-11-25 Pin กองกลาง 99
('2025-11-25T21:27:27+07:00', (SELECT id FROM p_pin), 'expense', (SELECT id FROM proj_central), 'ค่าน้ำมัน', 99, true, '2025-11-25T21:27:23+07:00', (SELECT id FROM p_iphone), 'https://drive.google.com/file/d/1fSsBHTovFNulYTmX4UoR03Xu8qlUacDK/view?usp=drivesdk', 'https://drive.google.com/file/d/1rXwmxDTJj9WJMw7h5CjBtl2a1UwCVRPo/view?usp=drivesdk'),

-- 26. 2025-11-26 iPhone กองกลาง 142.31
('2025-11-26T11:57:50+07:00', (SELECT id FROM p_iphone), 'expense', (SELECT id FROM proj_central), 'ค่าน้ำ', 142.31, true, '2025-11-26T11:57:46+07:00', (SELECT id FROM p_iphone), 'https://drive.google.com/file/d/1xlyXNw6Tgu8cNjJyVXFNey5emDM9znfO/view?usp=drivesdk', 'https://drive.google.com/file/d/1mM4nhyJLfZegeDP09BV7UKeNqYzj3jdk/view?usp=drivesdk'),

-- 27. 2025-11-26 iPhone กองกลาง 3351.34
('2025-11-26T12:05:37+07:00', (SELECT id FROM p_iphone), 'expense', (SELECT id FROM proj_central), 'ค่าไฟ', 3351.34, true, '2025-11-26T12:05:33+07:00', (SELECT id FROM p_iphone), 'https://drive.google.com/file/d/1Lbv-gwUUn9ZcLUKX-q-4OilMsqq10kw6/view?usp=drivesdk', 'https://drive.google.com/file/d/1colu1ZEu48z_rQNwrTrz323JDEynLC9r/view?usp=drivesdk');
