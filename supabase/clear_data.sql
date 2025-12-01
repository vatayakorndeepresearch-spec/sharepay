-- ลบข้อมูลรายการค่าใช้จ่ายทั้งหมด
TRUNCATE TABLE expenses CASCADE;

-- ลบข้อมูลโปรเจคทั้งหมด (ถ้าต้องการลบด้วย)
TRUNCATE TABLE projects CASCADE;

-- หมายเหตุ: ไม่ได้ลบตาราง profiles (พี่/น้อง) เพื่อให้ Script นำเข้าข้อมูลทำงานต่อได้เลย
