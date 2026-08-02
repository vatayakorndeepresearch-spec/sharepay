# SharePay — แผนปรับ UX/UI + รายการบั๊ก (ทั้งโปรเจค)

> **สถานะ: ลงมือแล้ว (2026-08-02)** — Phase 0-3 ทำครบตามแผน ยกเว้นที่ระบุไว้ใน [§9 สิ่งที่ยังไม่ได้ทำ](#9-สิ่งที่ยังไม่ได้ทำ-และเหตุผล)
> ยืนยัน: `npm run check` → 0 errors / 0 warnings · `npm run build` → ผ่าน · preview SSR: `/login` 200, `/` redirect 303, `/service-worker.js` 200


ตรวจเมื่อ 2026-08-02 · branch `main` · SvelteKit 2 + Svelte 5 (syntax legacy) + Tailwind 3 + Supabase
ขอบเขต: ทุกไฟล์ใน `src/routes` + `src/lib` + `src/app.css` + `src/app.html` + config
สถานะ baseline: `npm run check` → **0 errors, 0 warnings** (บั๊กด้านล่างเป็นระดับ logic/UX ไม่ใช่ type error)

---

## 0. สรุปผู้บริหาร

แอปเป็น mobile-first expense sharing ระหว่างพี่น้อง โครงหน้าจอครบแล้ว (Home / List / New / Bulk / Detail / Edit / Stats / Settings / Login / MFA) และภาษาดีไซน์หลัก (surface-card + slate + indigo + rounded-2xl) สม่ำเสมอในหน้าหลัก ๆ

ปัญหาใหญ่แบ่งได้ 3 กอง:

1. **บั๊กที่ทำข้อมูลเพี้ยน** — แก้ไขรายการที่ "เคลียร์แล้ว" จะถูกรีเซ็ตกลับเป็น "ยังไม่เคลียร์" เงียบ ๆ, กราฟหน้าอินไซต์ไม่อัปเดตเมื่อสลับโปรเจค, CSV export ไม่รวมคำค้นหา, ลบรูปแนบแล้วหน้าจอไม่อัปเดต
2. **UI ที่ยัง "ไม่สวย/ไม่จบ"** — การ์ดสถานะหน้าแรกโล่ง (ข้อมูลที่ server คำนวณไว้ไม่ถูกใช้), หน้า MFA ใช้ดีไซน์คนละภาษากับทั้งแอป, ไม่มี toast/feedback หลังบันทึก, ไม่มี skeleton, สีถูก hardcode กระจาย ~40 จุดทั้งที่มี CSS variable เตรียมไว้แล้วแต่ไม่ได้ใช้
3. **ช่องโหว่ UX เชิงฟีเจอร์** — บันทึกแทนคนอื่นไม่ได้ (`paid_by` ล็อกเป็นตัวเอง) ทั้งที่แอปนี้มีไว้แชร์ค่าใช้จ่าย, หมวดหมู่ 31 ตัวใน native select, bulk scan ไม่มี progress รวม, ไม่มี dark mode, ปิด pinch-zoom

ลำดับที่แนะนำ: **P0 บั๊กข้อมูล → P1 design token + feedback layer → P2 หน้าที่ยังไม่จบ → P3 ฟีเจอร์ UX**

---

## 1. ตารางบั๊ก เรียงตามความรุนแรง

### 🔴 P0 — ข้อมูลเพี้ยน / ผู้ใช้เสียของ

| # | ไฟล์ | อาการ | สาเหตุ | วิธีแก้ |
|---|------|-------|--------|---------|
| B1 | [expenses/[id]/edit/+page.server.ts:76](../src/routes/expenses/[id]/edit/+page.server.ts#L76) | แก้ไขรายการที่เคลียร์แล้ว → กลับเป็น "ยังไม่เคลียร์" ทันที ไม่มีคำเตือน | server อ่าน `formData.get('is_reimbursed') === 'on'` แต่ฟอร์มแก้ไข ([edit/+page.svelte](../src/routes/expenses/[id]/edit/+page.svelte)) **ไม่มี input ชื่อนี้เลย** → ได้ `false` เสมอ แล้ว `update()` เขียนทับ | เอา `is_reimbursed` ออกจาก `updates` object (ให้จัดการผ่าน action `reimburse`/`unreimburse` ที่หน้ารายละเอียดอย่างเดียว) หรือใส่ hidden input ส่งค่าเดิมกลับไป + sync `reimbursed_at`/`reimbursed_by` ด้วย |
| B2 | [expenses/[id]/edit/+page.server.ts:158-186](../src/routes/expenses/[id]/edit/+page.server.ts#L158) | ลบรูปแนบแล้วรูปยังอยู่บนจอ จนกว่าจะ refresh เอง | action `deleteAttachment` return `{success:true}` แต่ปุ่มอยู่ในฟอร์มที่ใช้ `use:enhance` แบบ custom ซึ่ง `update()` ถูกเรียกเฉพาะ path ของ `?/update` | แยกปุ่มลบออกเป็นฟอร์มของตัวเอง (นอกฟอร์มหลัก) + `use:enhance` มาตรฐาน หรือ `invalidateAll()` หลังสำเร็จ |
| B3 | [expenses/[id]/edit/+page.server.ts:171-183](../src/routes/expenses/[id]/edit/+page.server.ts#L171) | ลบรูปที่เป็นรูปหลัก → หน้ารายละเอียดโชว์รูปพัง (broken image) | `proof_image_url` บนตาราง `expenses` ไม่ถูกล้างเมื่อ attachment ถูกลบ (มีคอมเมนต์ยอมรับไว้ในโค้ดเอง) | ก่อนลบให้ `select file_url`; ถ้าตรงกับ `proof_image_url` ให้ set เป็น attachment ตัวถัดไป หรือ `null` |
| B4 | [stats/+page.svelte:86-88](../src/routes/stats/+page.svelte#L86) | สลับโปรเจคแล้วตัวเลขการ์ดเปลี่ยน แต่ **กราฟไม่เปลี่ยน** | `$: if (pieCanvas \|\| barCanvas) renderCharts()` — reactive dep คือตัว canvas เท่านั้น ไม่ใช่ `data` และ `bind:this` ไม่ re-fire ตอน data เปลี่ยน | เปลี่ยนเป็น `$: data, pieCanvas, barCanvas, renderCharts()` หรือชัดกว่า: `$: if (pieCanvas && data) renderCharts(data)` |
| B5 | [expenses/+page.svelte:112-120](../src/routes/expenses/+page.svelte#L112) + [expenses/export/+server.ts:22](../src/routes/expenses/export/+server.ts#L22) | CSV ที่โหลดได้ **ไม่ตรงกับที่เห็นบนจอ** เมื่อมีการค้นหา | URL export ไม่ส่ง `q` และ endpoint ก็ไม่รองรับ `q` | ส่ง `q` ใน `exportCsvUrl` + เพิ่ม `if (q) query.ilike('description', ...)` ใน export |
| B6 | [expenses/export/+server.ts:30](../src/routes/expenses/export/+server.ts#L30) | เสี่ยง export พังทั้งเส้น | ใช้ FK hint `profiles!paid_by` ขณะที่ทุกหน้าอื่นใช้ `profiles!expenses_paid_by_fkey` — ถ้า relationship กำกวมจะ error 500 | ใช้ hint เดียวกันทั้งโปรเจค + เพิ่ม `.limit()` กันดึงทั้งตาราง |
| B7 | [stores/ocrStore.ts:50-56](../src/lib/stores/ocrStore.ts#L50) เรียกจาก new/edit/bulk `onDestroy` | สแกนหลายสลิปแล้วกดออกจากหน้า → worker ถูกฆ่ากลางคัน, รายการที่เหลือขึ้น "อ่านไม่ได้" | worker เป็น singleton แชร์ทั้งแอป แต่ทุกหน้า `terminateOCRWorker()` ตอน destroy โดยไม่นับ reference และไม่รอ job ที่ค้าง | ทำ refcount (`acquire()` / `release()`) หรือปล่อยให้ worker อยู่ยาว แล้ว terminate ตอน `beforeunload` เท่านั้น |

### 🟠 P1 — UX เสียหาย / ผู้ใช้สับสน

| # | ไฟล์ | อาการ | วิธีแก้ |
|---|------|-------|---------|
| B8 | [+page.svelte:32-51](../src/routes/+page.svelte#L32) | การ์ดสถานะหน้าแรกโล่ง มีแค่ "สถานะตอนนี้" + ตัวเลข ไม่บอกว่า **ใครต้องโอนให้ใคร** | server คำนวณ `headline` / `subline` / `otherPartyName` / `unpaidCount` ไว้แล้วครบ ([+page.server.ts:96-130](../src/routes/+page.server.ts#L96)) แต่ UI ไม่เรียกใช้เลย — เสียบเข้าไป |
| B9 | [+page.svelte:39,46-51](../src/routes/+page.svelte#L39) | สถานะ `unknown` (ยังไม่ผูกโปรไฟล์) แสดงว่า "ไม่มีรายการค้าง" — โกหกผู้ใช้ | แยก branch ตาม `settlementSummary.state` 4 แบบ ไม่ใช่เช็ค `amount > 0` |
| B10 | ทุกหน้า form + action | บันทึก / เคลียร์ยอด / ลบ สำเร็จแล้ว **ไม่มีข้อความยืนยันใด ๆ** แค่เด้งหน้า | ทำ toast store กลาง (`$lib/stores/toast.ts`) + render ใน `+layout.svelte` |
| B11 | [+layout.svelte:28-81](../src/routes/+layout.svelte#L28), [expenses/+page.svelte:356](../src/routes/expenses/+page.svelte#L356), [[id]/+page.svelte:263](../src/routes/expenses/[id]/+page.svelte#L263) | bottom sheet ทุกอันปิดด้วย Esc ไม่ได้, ไม่มี focus trap, ไม่มี `role="dialog" aria-modal="true"`, พื้นหลังยัง scroll ได้ | ทำ `<Sheet>` component เดียวใช้ร่วมกัน 3 จุด (ดูข้อ 4.1) |
| B12 | [expenses/[id]/+page.svelte:53-83](../src/routes/expenses/[id]/+page.svelte#L53) | เมนู ⋯ เปิดแล้วปิดไม่ได้ถ้าไม่กดซ้ำ — ไม่มี click-outside / Esc | ใช้ `<svelte:window on:keydown>` + backdrop โปร่งใส |
| B13 | [expenses/[id]/+page.svelte:41,236-260](../src/routes/expenses/[id]/+page.svelte#L41) | รายการประเภท **รายรับ** ไม่มีปุ่มใน sticky bar เลย แต่ยังจอง `pb-36` → ช่องว่างขาวก้อนใหญ่ท้ายหน้า | เช็ค: ถ้าไม่มี action ให้ไม่ render `sticky-action-bar` และลด padding เป็น `pb-8` |
| B14 | [expenses/bulk/+page.svelte:82-155](../src/routes/expenses/bulk/+page.svelte#L82) | อัปโหลด 10 สลิป = รอ ~1 นาที เห็นแค่ spinner ต่อใบ ไม่รู้ว่าเหลืออีกกี่ใบ | progress bar รวม "กำลังอ่าน 3/10" + ปุ่มยกเลิกกลางคัน |
| B15 | [expenses/bulk/+page.svelte:520-531](../src/routes/expenses/bulk/+page.svelte#L520) | กด "บันทึก N รายการ" ทั้งที่บางใบ `amount` ว่าง → server ตีกลับทั้งชุด เสียงานทั้งหมด | validate ฝั่ง client: mark ใบที่ไม่ครบเป็นแดง + auto-expand + disable ปุ่ม พร้อมข้อความ "มี 2 รายการยังกรอกไม่ครบ" |
| B16 | [expenses/bulk/+page.svelte:510-519](../src/routes/expenses/bulk/+page.svelte#L510) | ปุ่ม "ล้างทั้งหมด" ลบคิวทิ้งทันที ไม่มี confirm | ใส่ confirm หรือทำ undo toast 5 วินาที |
| B17 | [expenses/new/+page.svelte:140](../src/routes/expenses/new/+page.svelte#L140), [bulk:88](../src/routes/expenses/bulk/+page.svelte#L88) | memory leak — `URL.createObjectURL()` ไม่เคย `revokeObjectURL()` | revoke ใน `onDestroy` + ตอน `removeItem` + ตอนเลือกไฟล์ชุดใหม่ |
| B18 | [expenses/new/+page.svelte:364](../src/routes/expenses/new/+page.svelte#L364), [edit:391](../src/routes/expenses/[id]/edit/+page.svelte#L391), [bulk:104](../src/routes/expenses/bulk/+page.svelte#L104) | **บันทึกแทนคนอื่นไม่ได้** — `paid_by` เป็น hidden input ล็อกเป็นตัวเอง ทั้งที่แอปคือ expense sharing | เปลี่ยนเป็น select ผู้จ่ายจากตาราง `profiles` (default = ตัวเอง) |
| B19 | [app.html:6](../src/app.html#L6) | `maximum-scale=1, user-scalable=0` — pinch zoom ใช้ไม่ได้ ผิดหลัก a11y (WCAG 1.4.4) | ตัดสองค่านี้ออก เหลือ `width=device-width, initial-scale=1` (input font-size ≥16px อยู่แล้วจึงไม่มีปัญหา iOS auto-zoom) |
| B20 | [expenses/+page.svelte:188-195](../src/routes/expenses/+page.svelte#L188) | โหมด "ทุกเดือน" ซ่อนปุ่ม → แต่ปุ่ม ← ยังกดได้แล้วกระโดดไปเดือนปัจจุบัน — ไม่สมมาตร งง | ในโหมด "ทุกเดือน" ซ่อน/disable ทั้งคู่ แล้วโชว์ปุ่ม "เลือกเดือน" แทน |
| B21 | [utils/formatDate.ts](../src/lib/utils/formatDate.ts) vs `<input type="date">` | รายการโชว์ปี พ.ศ. (`th-TH` → 2569) แต่ฟอร์มแก้ไขโชว์ ค.ศ. (2026) — ผู้ใช้สับสนว่าคนละรายการ | เลือกหนึ่งมาตรฐาน แนะนำบังคับ `th-TH-u-ca-gregory` ให้ทั้งแอปเป็น ค.ศ. |
| B22 | [utils/formatCurrency.ts](../src/lib/utils/formatCurrency.ts) vs [bulk:310](../src/routes/expenses/bulk/+page.svelte#L310) | เงินแสดง 2 แบบ: `฿1,234` (min 0 ทศนิยม) กับ `1,234.00` ในหน้า bulk | ใช้ `formatCurrency` ที่เดียวทั้งแอป + ตัดสินใจว่าทศนิยมโชว์เมื่อไม่ลงตัวเท่านั้น |
| B23 | [expenses/+page.server.ts:35](../src/routes/expenses/+page.server.ts#L35) | "โหลดเพิ่ม" ดึงใหม่ทั้ง `range(0, page*50)` ทุกครั้ง — หน้า 5 = ดึง 250 แถวซ้ำ | ใช้ cursor pagination (`lt('paid_at', lastDate)`) หรือ append ฝั่ง client |
| B24 | [expenses/+page.server.ts:55](../src/routes/expenses/+page.server.ts#L55) | ค้นหาเจอเฉพาะ `description` — พิมพ์ชื่อหมวดหรือข้อความใน note ไม่เจอ | `.or('description.ilike.%q%,notes.ilike.%q%,category.ilike.%q%')` |
| B25 | [api/categorize/+server.ts:9](../src/routes/api/categorize/+server.ts#L9) | ไม่มี `DEEPSEEK_API_KEY` → UI ขึ้น "AI กำลังวิเคราะห์..." แล้วเงียบหาย ไม่บอกอะไร | return flag `{category:'', reason:'disabled'}` แล้วซ่อน indicator ไปเลย |
| B26 | [expenses/new/+page.svelte:49](../src/routes/expenses/new/+page.svelte#L49) | เลือก "พิมพ์หมวดหมู่เอง" แล้วพิมพ์ description ต่อ → AI ทับ state หมวดที่พิมพ์เอง | guard เพิ่ม `if (isCustomCategory) return;` |

### 🟡 P2 — ความสวย / ความสม่ำเสมอ

| # | ที่ | ปัญหา |
|---|-----|-------|
| B27 | [auth/mfa/verify/+page.svelte](../src/routes/auth/mfa/verify/+page.svelte) | **ใช้ดีไซน์คนละภาษาทั้งหน้า** — `bg-gray-50`, `text-3xl font-extrabold`, `rounded-lg`, `shadow`, `border-gray-300` ขณะที่ทั้งแอปใช้ `slate`, `font-display`, `rounded-2xl`, `surface-card` ไม่มีเงา ต้อง rewrite ให้ตรงกับ [settings](../src/routes/settings/+page.svelte) |
| B28 | [app.css:6-15](../src/app.css#L6) + [tailwind.config.ts](../tailwind.config.ts) | ประกาศ `--brand-primary` … `--brand-border` ไว้ครบ **แต่ไม่ถูกใช้แม้แต่ที่เดียว** และ `theme.extend` ว่างเปล่า → สี hardcode `indigo-600`/`emerald-600`/`amber-500`/`rose-600` กระจายทั่วโปรเจค เปลี่ยนธีมทีต้อง sed ทั้งโค้ด |
| B29 | ทั้งแอป | ไม่มี dark mode ทั้งที่ `theme-color` + PWA `display: standalone` — เปิดกลางคืนแสบตา |
| B30 | ทั้งแอป | ไม่มี skeleton / loading state ระหว่าง `goto()` ตอนกรอง — กดแล้วเหมือนแอปค้าง |
| B31 | [+layout.svelte:87-135](../src/routes/+layout.svelte#L87) | ปุ่ม nav สูง ~40px (icon 20 + py-1.5) ต่ำกว่าเกณฑ์ touch target 44px ของ iOS; `.filter-chip` ~32px ยิ่งเล็ก |
| B32 | [app.css:76-81](../src/app.css#L76) | ตัวนับใน filter chip ใช้ `text-slate-400` แม้ตอน active บนพื้น `indigo-50` → contrast ต่ำกว่า 4.5:1 |
| B33 | [expenses/+page.svelte:99-104](../src/routes/expenses/+page.svelte#L99) | หัวกลุ่มวันที่เป็น `weekday สั้น + วัน + เดือนเต็ม + ปี` เช่น "อา. 2 สิงหาคม 2569" — ยาวจนตัดบรรทัดบนจอ 360px |
| B34 | [app.css:87-91](../src/app.css#L87) + [+layout.svelte:23,137](../src/routes/+layout.svelte#L23) | ระยะล่างคำนวณด้วยเลขมายิก 3 ชั้น: `app-shell pb-20` + `page-shell pb-24` + หน้าฟอร์ม `pb-36` + `sticky-action-bar bottom: safe+72px` ทับซ้อนกันเอง เครื่องที่มี safe-area จะได้ระยะไม่ตรง | ยกเป็นตัวแปรเดียว `--nav-h` แล้วอ้างอิงทุกที่ |
| B35 | [+page.svelte:36-38](../src/routes/+page.svelte#L36) | มีบรรทัดว่างเปล่า 2 บรรทัดในการ์ด hero (ร่องรอยโค้ดที่ถูกลบ) → การ์ดดูโล่งผิดจังหวะ |
| B36 | [settings](../src/routes/settings/+page.svelte) vs [+layout.svelte:134](../src/routes/+layout.svelte#L134) | nav เขียน "ตั้งค่า" แต่หัวหน้าเขียน "ความปลอดภัย" และในหน้ามีแค่ 2FA + logout — ไม่มีโปรไฟล์ / จัดการโปรเจค / ค่าเริ่มต้น |
| B37 | [+page.svelte:66-99](../src/routes/+page.svelte#L66) | การ์ดโปรเจคติดป้าย "ใช้งานอยู่" hardcode ทุกใบ, กดไม่ได้ (dead end), ไม่มี empty state ถ้ายังไม่มีโปรเจค |
| B38 | [stats/+page.server.ts:97](../src/routes/stats/+page.server.ts#L97) vs [expenses/+page.server.ts:74](../src/routes/expenses/+page.server.ts#L74) | หน้าอินไซต์กรองเฉพาะ `is_active` แต่หน้ารายการโชว์ทุกโปรเจค → dropdown สองหน้าไม่ตรงกัน |
| B39 | [stats/+page.server.ts:101](../src/routes/stats/+page.server.ts#L101) | ส่ง `totalExpense` มาแต่ UI ไม่ใช้; หน้าอินไซต์ไม่มีการเทียบเดือนก่อน / ไม่มีเส้นรายรับในกราฟ |
| B40 | [expenses/new/+page.svelte:321-340](../src/routes/expenses/new/+page.svelte#L321) | หมวดหมู่รายจ่าย 31 ตัวใน native `<select>` ไม่มีการจัดกลุ่ม เลื่อนหายาวมากบนมือถือ |
| B41 | [expenses/new/+page.svelte:212-224](../src/routes/expenses/new/+page.svelte#L212) | ช่องเงิน `type="number"` ไม่มี `inputmode="decimal"` และมีลูกศร spinner โผล่บน desktop ทับสัญลักษณ์ ฿ |
| B42 | [login](../src/routes/login/+page.svelte) | หน้า login มีแค่ไอคอนกุญแจ ไม่มี logo/wordmark, ตอนโหลดเป็นข้อความเปล่าไม่มี spinner, ไม่มี copy บอกว่าแอปทำอะไร |
| B43 | [expenses/bulk/+page.svelte:539-554](../src/routes/expenses/bulk/+page.svelte#L539) | lightbox เป็น `<img>` ซ้อนใน `<button>` เต็มจอ — a11y แปลก, ไม่มีปุ่มปิดที่มองเห็น, zoom ไม่ได้ |
| B44 | [manifest.json](../static/manifest.json) + ไม่มี service worker | ประกาศ PWA `standalone` แต่ไม่มี offline shell — เปิดตอนเน็ตหลุดได้หน้าขาว |
| B45 | repo root | `debug_balance.js` ยัง track อยู่ใน git, `.DS_Store` และ `.svelte-kit` ค้างในโฟลเดอร์ (gitignore ครอบแล้วแต่ไฟล์ยังอยู่) |

> หมายเหตุความมั่นใจ: B1, B5, B17, B18, B19, B27, B28, B35, B45 ยืนยันจากโค้ดตรง ๆ · B4, B7, B23 มั่นใจสูงจากการอ่าน semantics แต่ควรทดสอบในเบราว์เซอร์จริงก่อนแก้ · B6 ต้องตรวจกับ schema จริงใน Supabase (`profiles!paid_by` อาจใช้ได้ถ้ามี FK เดียว)

---

## 2. Design system — ชั้นที่ยังขาด

ตอนนี้ `app.css` มี component class ที่ดีอยู่แล้ว (`surface-card`, `field-input`, `status-chip`, `sticky-action-bar`) แต่ **สีไม่ผ่าน token** ทำให้:
- เปลี่ยนธีมไม่ได้
- ทำ dark mode ไม่ได้
- accent ไม่นิ่ง: indigo (หน้าแรก) / amber+emerald (หน้ารายละเอียด) / slate-900 (ปุ่มรายจ่าย) / emerald-600 (ปุ่มรายรับ)

### 2.1 เป้าหมาย token

```css
/* app.css — ชั้นเดียว ใช้ทั้งแอป */
:root {
  --bg:            248 250 252;   /* slate-50  */
  --surface:       255 255 255;
  --surface-muted: 241 245 249;   /* slate-100 */
  --border:        226 232 240;   /* slate-200 */
  --text:           15  23  42;   /* slate-900 */
  --text-muted:    100 116 139;   /* slate-500 */
  --accent:         79  70 229;   /* indigo-600 */
  --accent-soft:   238 242 255;   /* indigo-50  */
  --income:         16 185 129;   /* emerald-500 */
  --pending:       245 158  11;   /* amber-500   */
  --danger:        225  29  72;   /* rose-600    */
  --nav-h: 68px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: 2 6 23; --surface: 15 23 42; --surface-muted: 30 41 59;
    --border: 51 65 85; --text: 241 245 249; --text-muted: 148 163 184;
    --accent-soft: 30 27 75;
  }
}
```

`tailwind.config.ts` ผูกเข้า theme:

```ts
theme: {
  extend: {
    colors: {
      bg: "rgb(var(--bg) / <alpha-value>)",
      surface: "rgb(var(--surface) / <alpha-value>)",
      border: "rgb(var(--border) / <alpha-value>)",
      accent: "rgb(var(--accent) / <alpha-value>)",
      income: "rgb(var(--income) / <alpha-value>)",
      pending: "rgb(var(--pending) / <alpha-value>)",
      danger: "rgb(var(--danger) / <alpha-value>)",
    },
    spacing: { nav: "var(--nav-h)" },
  },
}
```

จากนั้นแทน `bg-white` → `bg-surface`, `text-slate-900` → `text-text`, `bg-indigo-600` → `bg-accent` ทีละหน้า (แก้เชิงกลไก ทำได้ด้วย sed + ตรวจตา)

### 2.2 กฎสีเชิงความหมาย (ตัดสินให้จบ ใช้เหมือนกันทุกหน้า)

| ความหมาย | สี | ใช้ที่ |
|-----------|-----|--------|
| แอ็กชันหลัก / navigation active | `accent` (indigo) | ปุ่มบันทึก, FAB, tab ที่เลือก |
| รายรับ / เคลียร์แล้ว / สำเร็จ | `income` (emerald) | ยอดรายรับ, chip "เคลียร์แล้ว", ปุ่มยืนยันเคลียร์ |
| ค้างจ่าย / รอดำเนินการ | `pending` (amber) | chip "ค้าง", hero การ์ดรายการที่ยังไม่เคลียร์ |
| ทำลาย / ผิดพลาด | `danger` (rose) | ลบ, error banner, logout |
| กลาง / รายจ่ายปกติ | slate | ยอดรายจ่าย, ไอคอนพื้นหลัง |

**สิ่งที่ต้องเลิกทำ:** ปุ่ม toggle "รายจ่าย" ใช้ `bg-slate-900` (ดูเหมือนปุ่มหลัก) คู่กับ "รายรับ" `bg-emerald-600` — สองปุ่มคนละน้ำหนักสายตา ทั้งที่เป็นตัวเลือกระดับเดียวกัน → ใช้ segmented control พื้น `surface-muted` + ตัวที่เลือกเป็น `surface` + ขอบ accent

### 2.3 typography scale

ตอนนี้มี `text-2xl` (หัวหน้า Home/List), `text-xl` (หัวหน้าฟอร์ม), `text-3xl` (ยอดเงิน hero) ผสมกันไม่มีสเกล กำหนด:

| ระดับ | class | ใช้ |
|-------|-------|-----|
| Display | `text-3xl font-bold font-display` | ยอดเงินใน hero card เท่านั้น |
| H1 | `text-2xl font-bold font-display` | หัวทุกหน้า (รวมหน้าฟอร์ม — ตอนนี้ใช้ `text-xl` ไม่ตรงกัน) |
| H2 | `text-base font-bold` | หัว section |
| Body | `text-sm` | ข้อความหลัก |
| Meta | `text-xs text-muted` | วันที่, ชื่อคน, ป้ายกำกับ |

---

## 3. ปรับรายหน้า

### 3.1 หน้าแรก `/` — ปัญหาหนักสุดเรื่องความว่างเปล่า

**ตอนนี้:** hero การ์ด indigo แสดงแค่ "สถานะตอนนี้" + ยอด + ปุ่ม CTA · ข้อมูล `headline`/`subline`/`otherPartyName`/`unpaidCount` ที่ server อุตส่าห์คำนวณ **ถูกทิ้ง**

**เป้า:**
```
┌─────────────────────────────────┐
│ ⏱ สถานะตอนนี้                    │
│                                 │
│ คุณต้องโอน พี่เอ               │  ← headline (text-lg font-bold)
│ ฿4,250                          │  ← amount  (text-3xl font-display)
│ จาก 6 รายการที่ยังไม่เคลียร์      │  ← unpaidCount
│                                 │
│ [ เคลียร์ยอดตอนนี้  → ]         │  ← ctaLabel / ctaHref (มีอยู่แล้ว)
└─────────────────────────────────┘
```
- state `clear` → เปลี่ยนพื้นการ์ดเป็น emerald + ไอคอน ✓ + copy "เคลียร์ครบแล้ว 🎉"
- state `unknown` → พื้น slate + copy "ยังไม่ได้ผูกโปรไฟล์" + CTA ไปหน้าตั้งค่า (**ห้าม** แสดง "ไม่มีรายการค้าง" — B9)

**อื่น ๆ ในหน้านี้**
- การ์ดโปรเจค: ทำให้กดได้ → `/expenses?project=<id>`, เอาป้าย "ใช้งานอยู่" hardcode ออก หรือผูกกับ `is_active` จริง, เพิ่มแถบสัดส่วนรายรับ/รายจ่ายเล็ก ๆ ใต้ตัวเลข
- เพิ่ม empty state เมื่อไม่มีโปรเจคเลย
- "รายการล่าสุด" 8 รายการ: ตอนนี้ไม่โชว์ชื่อโปรเจค (ต่างจากหน้ารายการ) → ใส่ให้ตรงกัน

### 3.2 หน้ารายการ `/expenses`

- ย้าย search + month picker + filter chips ให้เป็น **sticky header** (ตอนนี้ scroll หายไปหมด ต้องเลื่อนกลับขึ้นสุดเพื่อเปลี่ยน filter)
- แถบเดือน: โหมด "ทุกเดือน" ให้ปุ่มลูกศรหายทั้งคู่ + โชว์ปุ่ม "เลือกเดือน" (แก้ B20)
- แสดง filter ที่ active เป็น chip ถอดได้เหนือรายการ ("โปรเจค: กองกลาง ✕", "ค้นหา: กาแฟ ✕") — ตอนนี้เปิด sheet เท่านั้นถึงจะรู้ว่ากรองอะไรอยู่
- หัวกลุ่มวันที่ให้สั้นลง: `2 ส.ค.` + วันนี้/เมื่อวานเป็นคำ (แก้ B33) และเพิ่มยอดรวมของวันไว้ทางขวา
- แต่ละแถวเพิ่ม swipe action (ปัดซ้าย = เคลียร์ยอด, ปัดขวา = แก้ไข) — ตอนนี้ต้องเข้า 2 ชั้นเพื่อกดเคลียร์ 1 รายการ ซึ่งเป็น action ที่ใช้บ่อยที่สุดของแอป
- ปุ่ม CSV: ย้ายไปอยู่ใน advanced filter sheet พร้อมตัวเลือก XLSX (endpoint รองรับอยู่แล้วแต่ UI ไม่มีทางเข้าถึง)
- เพิ่ม skeleton 5 แถวระหว่างโหลด

### 3.3 หน้าเพิ่มรายการ `/expenses/new`

- segmented control รายจ่าย/รายรับ ให้สมมาตร (ดู 2.2)
- ช่องเงิน: `inputmode="decimal"`, ซ่อน spinner, ใส่ปุ่มลัด `+100 / +500 / +1000` ใต้ช่อง
- อัปโหลดสลิป: รองรับ **paste จาก clipboard** และ drag-drop (เดสก์ท็อป) นอกจากกดเลือก
- ระหว่าง OCR: แทน spinner เฉย ๆ ด้วย shimmer บนช่องที่กำลังจะถูกเติม + สรุปหลังเสร็จ "เติมให้แล้ว 3 ช่อง · แตะเพื่อแก้"
- หมวดหมู่: chip 6 ตัวที่ใช้บ่อยล่าสุด + ปุ่ม "ดูทั้งหมด" เปิด sheet ที่มีช่องค้นหา (แก้ B40)
- ผู้จ่าย: เปลี่ยนจาก hidden เป็น selector เลือกคนได้ (แก้ B18)
- เพิ่ม `beforeunload` เตือนเมื่อกรอกค้างแล้วจะออกจากหน้า

### 3.4 หน้าสแกนหลายใบ `/expenses/bulk`

- progress รวม + ปุ่มหยุด (B14)
- badge สรุปด้านบน: "พร้อม 7 · ต้องแก้ 2 · อ่านไม่ได้ 1" กดกรองได้
- ใบที่ข้อมูลไม่ครบ = ขอบแดง + auto expand + ปุ่มบันทึกบอกจำนวนที่ค้าง (B15)
- ปุ่ม "ล้างทั้งหมด" ใส่ confirm/undo (B16)
- ทำ "ใช้ค่านี้กับทุกใบ" สำหรับโปรเจค / ผู้จ่าย / วันที่ (ตอนนี้ต้องแก้ทีละใบ)
- lightbox: ทำเป็น dialog มีปุ่มปิดจริง + เลื่อนดูใบถัดไปได้ (B43)

### 3.5 หน้ารายละเอียด `/expenses/[id]`

- hero: ตอนนี้ amber/emerald เต็มใบ ตัวหนังสือขาว — แข็งไป เสนอเป็นการ์ดขาวมีแถบสีด้านซ้าย 4px + chip สถานะ อ่านง่ายกว่าและเข้ากับหน้าอื่น
- รายรับ: ไม่ render sticky bar และลด padding (B13)
- Timeline: ตอนนี้ใช้ `paid_at` เป็นวันที่ "สร้างรายการ" ซึ่งผิดความหมาย → ใช้ `created_at` และเพิ่มเหตุการณ์แก้ไขล่าสุด
- รูปหลักฐาน: กดแล้วเปิด lightbox ในแอป (ตอนนี้เปิดแท็บใหม่ไปที่ Supabase URL ดิบ)
- เมนู ⋯ ปิดด้วย Esc/click-outside (B12) และปุ่มลบใช้ dialog แทน `confirm()` ของเบราว์เซอร์

### 3.6 หน้าอินไซต์ `/stats`

- แก้ reactivity ของกราฟก่อนอย่างอื่น (B4)
- เพิ่มเทียบเดือนก่อน: "฿12,400 · +18% จากเดือนที่แล้ว" (มีข้อมูล `monthly_values` อยู่แล้ว คำนวณฝั่ง client ได้เลย)
- กราฟแท่ง: เพิ่ม dataset รายรับซ้อน เพื่อเห็น cashflow ไม่ใช่แค่รายจ่าย
- โดนัท: เอา legend 6 ช่องที่กินพื้นที่ออก → ใช้ list ใต้กราฟที่มี % + ยอด + แถบสัดส่วน กดแล้วกรองไปหน้ารายการ
- เพิ่ม toggle ช่วงเวลา (เดือนนี้ / 3 เดือน / ปีนี้) — ตอนนี้กรองได้แต่โปรเจค
- ใช้ `totalExpense` ที่ส่งมาแล้วให้เป็นประโยชน์ (B39)
- ใส่ chart color จาก token ไม่ hardcode ใน server (`stats/+page.server.ts:79,89`)

### 3.7 หน้าตั้งค่า `/settings`

- เปลี่ยนหัวเป็น "ตั้งค่า" ให้ตรง nav แล้วแบ่งกลุ่ม: **โปรไฟล์** (รูป, ชื่อ, อีเมล) → **โปรเจค** (เพิ่ม/ปิดใช้งาน) → **ความปลอดภัย** (2FA) → **ข้อมูล** (export ทั้งหมด) → **ออกจากระบบ**
- ปุ่มออกจากระบบใส่ confirm
- แสดงเวอร์ชันแอป + ลิงก์ล้าง cache/worker

### 3.8 `/login` และ `/auth/mfa/verify`

- MFA: rewrite ให้ใช้ระบบเดียวกับทั้งแอป (B27) + ทำช่องกรอกเป็น 6 ช่องแยก auto-advance + `autocomplete="one-time-code"` (มีแล้ว) + auto-submit เมื่อครบ 6 หลัก
- Login: ใส่ wordmark + tagline สั้น, spinner ตอนกำลังเชื่อมต่อ, ทำ container เป็น `surface-card` ให้เหมือนหน้าอื่น

---

## 4. ชิ้นส่วนที่ต้องสร้างใหม่ (shared components)

ตอนนี้โค้ดซ้ำมาก: bottom sheet เขียนซ้ำ 3 ที่, identity chip 3 ที่, ฟอร์ม new/edit ซ้ำกันเกือบทั้งไฟล์ (420 vs 435 บรรทัด แทบเหมือนกัน)

| Component | แทนที่ | ประหยัด |
|-----------|--------|---------|
| `Sheet.svelte` (backdrop + Esc + focus trap + scroll lock) | layout:28, expenses:356, [id]:263 | ~120 บรรทัด + แก้ B11 ทีเดียว 3 จุด |
| `ExpenseForm.svelte` (props: mode new/edit) | new/+page.svelte + edit/+page.svelte | ~350 บรรทัด และกันบั๊กแบบ B1 ที่เกิดจากสองไฟล์ไม่ sync กัน |
| `Toast.svelte` + store | — (ยังไม่มี) | แก้ B10 |
| `MoneyInput.svelte` | new, edit, bulk | รวมกฎ inputmode/format ที่เดียว |
| `IdentityChip.svelte` | new:367, edit:394, [id]:304 | ~45 บรรทัด |
| `EmptyState.svelte` | home:110, expenses:263, bulk:238, stats:143 | ~60 บรรทัด และทำให้ 4 ที่หน้าตาเหมือนกันจริง |
| `ExpenseRow.svelte` | home:123, expenses:284 (ตอนนี้ไม่เหมือนกัน — หน้าแรกไม่โชว์โปรเจค) | ~70 บรรทัด |
| `Skeleton.svelte` | ทุกหน้า | แก้ B30 |

---

## 5. Accessibility checklist

- [ ] เอา `user-scalable=0` ออก (B19)
- [ ] Sheet ทุกอัน: `role="dialog" aria-modal="true"`, Esc ปิด, focus trap, คืน focus ให้ปุ่มที่เปิด, ล็อก scroll พื้นหลัง (B11)
- [ ] touch target ≥ 44×44 ทุกปุ่ม (nav, filter chip, ปุ่มไอคอน 36px ในหัวหน้า) (B31)
- [ ] contrast ≥ 4.5:1 — ตรวจ `text-slate-400` บนพื้นขาว (ใช้เยอะมากทั้งแอป, อยู่ที่ ~3.4:1 → เปลี่ยนเป็น `slate-500`) และตัวนับใน chip active (B32)
- [ ] `alt` ของรูปหลักฐานเป็นภาษาไทยและสื่อความ (ตอนนี้ "Proof", "Slip preview")
- [ ] indicator `:focus-visible` — ตอนนี้มีแค่ `focus:ring` ที่ input ปุ่มไม่มีเลย
- [ ] เคารพ `prefers-reduced-motion` สำหรับ `fly`/`scale`/`animate-pulse`
- [ ] ปุ่มไอคอนล้วนมี `aria-label` (ส่วนใหญ่มีแล้ว ✓ แต่ [expenses/+page.svelte:174,188](../src/routes/expenses/+page.svelte#L174) ปุ่มเดือนยังไม่มี)

---

## 6. Performance

- โหลด Google Fonts 2 ตระกูล น้ำหนักเต็มช่วง (variable) แบบ render-blocking → จำกัดเฉพาะน้ำหนักที่ใช้ (400/500/600/700) หรือ self-host
- `tesseract.js` + `chart.js` + `xlsx` ทั้งสามตัวหนัก — chart.js ทำ dynamic import แล้ว ✓ · tesseract dynamic แล้ว ✓ · `xlsx` อยู่ฝั่ง server ✓ · เหลือแค่ preload tesseract เมื่อผู้ใช้เข้าหน้าที่จะใช้จริง
- แก้ pagination ให้ไม่ดึงซ้ำ (B23)
- เพิ่ม service worker ทำ offline shell + cache หน้ารายการล่าสุด (B44)
- `preprocessImage` ทำงานบน main thread บนภาพ 1800px กว้าง → บล็อก UI 200-500ms ต่อรูป ควรย้ายไป Web Worker (สำคัญมากในหน้า bulk ที่วนหลายรูป)

---

## 7. แผนลงมือ (แนะนำเรียงแบบนี้)

### Phase 0 — หยุดเลือด (ครึ่งวัน)
1. B1 แก้ `is_reimbursed` ถูกรีเซ็ตตอนแก้ไข ← **ทำก่อนสุด ข้อมูลผู้ใช้เพี้ยนอยู่ตอนนี้**
2. B4 กราฟอินไซต์ไม่อัปเดต
3. B5 CSV ไม่ตรงกับหน้าจอ
4. B2 + B3 ลบรูปแนบ
5. B9 หน้าแรกบอกสถานะผิด
6. B6 ตรวจ FK hint ของ export กับ schema จริง

### Phase 1 — รากฐาน (1-2 วัน)
7. Token + tailwind theme (2.1) + dark mode
8. `Sheet` / `Toast` / `EmptyState` / `Skeleton` components
9. แก้ระยะล่างให้เป็น `--nav-h` ตัวเดียว (B34) + touch target + contrast
10. เอา `user-scalable=0` ออก

### Phase 2 — หน้าที่ยังไม่จบ (2-3 วัน)
11. Hero หน้าแรกใช้ข้อมูลที่มีอยู่ให้ครบ (3.1)
12. รวม new/edit เป็น `ExpenseForm` เดียว + ผู้จ่ายเลือกได้ (B18)
13. rewrite หน้า MFA + polish login (3.8)
14. sticky filter + active filter chips + swipe action ในหน้ารายการ (3.2)
15. bulk: progress รวม + validation + bulk edit (3.4)

### Phase 3 — ต่อยอด (ตามเวลา)
16. อินไซต์ระดับใช้งานจริง: เทียบเดือน, cashflow, กดกราฟกรองต่อ (3.6)
17. หน้าตั้งค่าเต็มรูปแบบ + จัดการโปรเจค (3.7)
18. service worker / offline
19. ย้าย `preprocessImage` ไป Web Worker
20. เก็บกวาด: ลบ `debug_balance.js`, `.DS_Store`

---

## 8. เกณฑ์ตรวจรับ (definition of done)

- `npm run check` ยังคง 0 errors / 0 warnings
- แก้ไขรายการที่เคลียร์แล้วบันทึกซ้ำ → สถานะยังเป็น "เคลียร์แล้ว" และ `reimbursed_at` ไม่เปลี่ยน
- สลับโปรเจคในหน้าอินไซต์ → ทั้งการ์ดและกราฟทั้งสองอันเปลี่ยนพร้อมกัน
- ค้นหา "กาแฟ" แล้วโหลด CSV → จำนวนแถวใน CSV เท่ากับ `filteredCount` บนจอ
- ทุก sheet ปิดได้ด้วย Esc และ focus กลับไปที่ปุ่มที่เปิด
- ทุกปุ่มมีพื้นที่กด ≥ 44px (ตรวจด้วย devtools)
- เปิดโหมดมืดของเครื่อง → ไม่มีพื้นที่ขาวจ้าหลงเหลือ
- อัปโหลดสลิป 10 ใบ → เห็น progress 1/10…10/10 และยกเลิกกลางคันได้โดยของที่อ่านเสร็จแล้วไม่หาย
- บันทึก / เคลียร์ยอด / ลบ → ขึ้น toast ยืนยันทุกครั้ง

---

## 9. สิ่งที่ยังไม่ได้ทำ และเหตุผล

รายการด้านล่างอยู่ในแผนแต่ **จงใจข้าม** ในรอบนี้ ไม่ได้ทำแล้วลืม

| จากหัวข้อ | สิ่งที่ข้าม | เหตุผล |
|-----------|-------------|--------|
| 3.2 | swipe action บนแถวรายการ (ปัดเพื่อเคลียร์/แก้ไข) | ต้องเขียน gesture handler เอง + ชนกับ scroll แนวนอนของแถบ filter chip ที่เพิ่งใส่ ควรทำเป็นงานแยกพร้อมทดสอบบนเครื่องจริง |
| 3.3 | อัปโหลดด้วย paste จาก clipboard / drag-drop | ต้องทดสอบข้ามเบราว์เซอร์จริงถึงจะรู้ว่าใช้ได้ ทำแบบเดาไม่ได้ |
| 3.5 | เหตุการณ์ "แก้ไขล่าสุด" ใน timeline | ตาราง `expenses` ไม่มี `updated_at` ต้องเพิ่ม migration ก่อน |
| 3.6 | เส้นรายรับในกราฟแท่ง + toggle ช่วงเวลา (3 เดือน / ปีนี้) | RPC `get_stats_summary` คืนเฉพาะรายจ่ายรายเดือนและไม่รับพารามิเตอร์ช่วงเวลา ต้องแก้ฝั่ง DB ก่อน |
| 6 | ย้าย `preprocessImage` ไป Web Worker | เป็นงาน refactor ที่ควรวัด before/after จริง ไม่ควรรวมกับ PR ที่แตะ UI ทั้งแอป |
| 6 | self-host ฟอนต์ | ลดเหลือเฉพาะน้ำหนักที่ใช้ (Inter 400/500/600/700, Outfit 600/700) แทน ได้ประโยชน์ส่วนใหญ่โดยไม่ต้องเพิ่มไฟล์ในโปรเจค |
| 3.4 | lightbox เลื่อนดูใบถัดไปในหน้า bulk | ใส่ปุ่มปิดจริงและ overlay ที่เข้าถึงได้แล้ว ส่วนการเลื่อนเป็น nice-to-have |

**ยังไม่ได้ verify ด้วยตาบนเบราว์เซอร์จริง** — เครื่องนี้ไม่มี Playwright/Chromium และเข้าสู่ระบบด้วย Google แบบ headless ไม่ได้ จึงตรวจได้แค่ SSR ของหน้าที่ไม่ต้อง auth เกณฑ์ใน §8 ที่ต้องดูด้วยตา (dark mode, touch target, sheet focus trap, progress ตอนสแกน 10 ใบ) **ต้องรันเองอีกรอบ**

### บั๊กที่แก้แล้วแต่ควรลองจริงก่อนวางใจ
- **B4** กราฟอินไซต์ — ผูก reactive statement กับ `data` แล้ว + กัน race ตอน dynamic import ด้วย render token
- **B6** `profiles!expenses_paid_by_fkey` ในหน้า export — เปลี่ยนให้ตรงกับหน้าอื่นแล้ว แต่ยังไม่ได้ยิงกับ Supabase จริง
- **B23** pagination — เปลี่ยนเป็นดึงทีละหน้าแล้ว append ฝั่ง client (`.range((page-1)*50, page*50-1)` + tiebreaker `order('id')`) ควรลองกดโหลดเพิ่มกับข้อมูลจริงที่มีหลายรายการวันเดียวกัน
