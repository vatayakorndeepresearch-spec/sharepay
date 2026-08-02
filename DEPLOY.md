# การ Deploy ขึ้น Vercel 🚀

โปรเจคนี้พร้อมสำหรับ Deploy ขึ้น Vercel แล้วครับ นี่คือขั้นตอน:

## 1. เตรียม GitHub
1.  สร้าง Repository ใหม่ใน GitHub
2.  Push โค้ดทั้งหมดขึ้นไป:
    ```bash
    git add .
    git commit -m "Ready for deploy"
    git branch -M main
    git remote add origin <YOUR_REPO_URL>
    git push -u origin main
    ```

## 2. ตั้งค่าใน Vercel
1.  ไปที่ [Vercel Dashboard](https://vercel.com/dashboard)
2.  กด **"Add New..."** > **"Project"**
3.  เลือก Repository ที่เพิ่ง Push ไป
4.  ในหน้า **Configure Project**:
    *   **Framework Preset:** SvelteKit (น่าจะเลือกให้อัตโนมัติ)
    *   **Environment Variables:** (สำคัญมาก! ⚠️)
        *   เปิดไฟล์ `.env` ในเครื่องดูค่า
        *   ก๊อปปี้ค่าไปใส่ใน Vercel:
            *   `PUBLIC_SUPABASE_URL`
            *   `PUBLIC_SUPABASE_ANON_KEY`
            *   `DEEPSEEK_API_KEY` (จัดหมวดหมู่ + แปลงข้อความสลิปเป็น JSON)
        *   สำหรับอ่านสลิปด้วย AI (ดู `docs/OCR_IMPLEMENTATION.md`):
            *   `SLIP_AI_PROVIDER` (`typhoon` หรือ `openrouter`)
            *   `TYPHOON_API_KEY` หรือ `OPENROUTER_API_KEY` + `OPENROUTER_MODEL`
            *   `PUBLIC_SLIP_AI_ENABLED` — ตั้ง `false` ก่อนเพื่อ deploy แบบปิดไว้ (ระบบจะใช้ Tesseract เหมือนเดิม) แล้วค่อยเปลี่ยนเป็น `true`

## 3. กด Deploy
*   กดปุ่ม **Deploy** แล้วรอสักครู่
*   เมื่อเสร็จแล้ว Vercel จะให้ URL มา (เช่น `sarepay.vercel.app`)
*   ลองเข้าใช้งานได้เลย!

## หมายเหตุ
*   ถ้าเจอ Error ตอน Build ให้ลองเช็คว่าใส่ Environment Variables ครบหรือยัง
*   Database ใช้ตัวเดิม (Supabase) ได้เลย ไม่ต้องทำอะไรเพิ่ม ข้อมูลจะเชื่อมต่อกันอัตโนมัติครับ
