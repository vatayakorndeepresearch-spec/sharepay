# วิธีเชื่อมต่อ Supabase (แบบไม่ต้อง Login)

ทำตามขั้นตอนทีละสเต็ปนะครับ:

## 1. สร้างโปรเจค Supabase
1. ไปที่ [supabase.com](https://supabase.com) แล้ว Log in
2. กดปุ่ม **"New Project"**
3. ตั้งชื่อโปรเจค (เช่น `Share Pay`) และตั้งรหัสผ่าน Database
4. เลือก Region เป็น **Singapore**
5. กด **Create new project**

## 2. เอาค่า Key มาใส่ใน .env
1. ไปที่ **Project Settings** (icon รูปเฟือง) > **API**
2. Copy **Project URL** และ **anon / public key**
3. ใส่ในไฟล์ `.env`:

```env
PUBLIC_SUPABASE_URL=https://your-project-url.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## 3. สร้างตาราง (Database Schema)
1. ไปที่ **SQL Editor** (icon รูปกระดาษ) > **New query**
2. Copy โค้ดจากไฟล์ `supabase/schema_no_auth.sql` (ไฟล์ใหม่)
3. Paste ใส่ใน SQL Editor แล้วกด **Run**
   - *ถ้าเคยสร้างตารางไปแล้ว ให้ Run อันนี้ทับได้เลย มันจะลบของเก่าแล้วสร้างใหม่*

## 4. สร้างที่เก็บรูป (Storage)
1. ไปที่ **Storage** > **New Bucket**
2. ตั้งชื่อว่า `expense_proofs`
3. เปิด **Public bucket** เป็น **ON**
4. กด **Save**

---

## เสร็จแล้ว!
รันโปรแกรม:

```bash
npm run dev
```

ตอนนี้แอพจะไม่มีหน้า Login แล้ว สามารถเลือกชื่อคนจ่ายได้เลยตอนเพิ่มรายการ
