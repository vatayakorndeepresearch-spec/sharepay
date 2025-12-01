# Share Pay

เว็บแอพสำหรับติดตามค่าใช้จ่ายกองกลางและโปรเจคต่าง ๆ สำหรับ 2 คน (พี่น้อง)
สร้างด้วย SvelteKit + Supabase + Tailwind CSS

## Features

- **Dashboard**: ดูยอดหนี้รวมที่ต้องคืนให้น้อง
- **Expenses**: บันทึกรายการค่าใช้จ่าย แยกตามโปรเจค (กองกลาง, BigLot)
- **Proof**: แนบรูปสลิป/ใบเสร็จได้
- **Reimbursement**: กดเคลียร์หนี้เมื่อจ่ายคืนแล้ว

## Setup

### 1. Prerequisites

- Node.js 18+
- Supabase Account

### 2. Installation

```bash
npm install
```

### 3. Environment Variables

สร้างไฟล์ `.env` จาก `.env.example`:

```bash
cp .env.example .env
```

แก้ไขค่าใน `.env`:

```env
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Database Setup (Supabase)

1. ไปที่ Supabase Dashboard > SQL Editor
2. New Query
3. Copy เนื้อหาจาก `supabase/schema.sql` ไปวางแล้วกด Run
4. **สำคัญ**: สร้าง Storage Bucket ชื่อ `expense_proofs`
   - ไปที่ Storage > New Bucket
   - Name: `expense_proofs`
   - Public: On (เพื่อให้ดูรูปได้ง่าย)
   - Allowed MIME types: `image/png`, `image/jpeg`

### 5. Run Development Server

```bash
npm run dev
```

เปิด [http://localhost:5173](http://localhost:5173)

## Deployment

สามารถ Deploy บน Vercel หรือ Netlify ได้ทันที (ต้องตั้งค่า Environment Variables ใน Dashboard ของ Host ด้วย)
