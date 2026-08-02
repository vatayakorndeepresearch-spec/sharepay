# แผนปรับ Performance — SharePay

> เป้าหมาย: first load เบาลง ~700 KB, ทุก navigation เร็วขึ้น 100–300 ms, หน้า stats ไม่อืดตามข้อมูลที่โต, UI ไม่ค้างตอนสแกนสลิป
>
> เรียงตาม impact ต่อแรงที่ลง. ทำทีละ phase, วัดผลหลังจบ phase (วิธีวัดอยู่ท้ายไฟล์).

## สถานะ (2026-08-02)

| ข้อ | สถานะ | หมายเหตุ |
| --- | --- | --- |
| 1.1 ลบ browser client | ✅ ทำแล้ว | client nodes รวม 608 KB → 256 KB, node 0 จาก 203 KB เหลือหลัก KB |
| 1.2 getClaims แทน getUser | ⛔ ติด blocker | JWKS ของโปรเจกต์ยังว่าง = ยังเป็น legacy HS256 ทำให้ `getClaims()` fallback ไปยิง network เหมือนเดิม ต้อง migrate เป็น asymmetric signing keys ใน dashboard ก่อน |
| 1.3 lazy layerchart | ✅ ทำแล้ว | node ของ `/stats` เหลือ 12.5 KB, layerchart กลายเป็น `import()` |
| 1.4 icons + SW precache | ✅ ทำแล้ว | ไอคอน 1.12 MB → 83 KB, precache เหลือ `[...build]` |
| 2.1 stats RPC | ⚠️ โค้ดพร้อม รอ apply | migration `supabase/migrations/20260802_stats_aggregate.sql` ยัง **ไม่ได้รัน** (MCP อยู่ read-only, CLI ยังไม่ได้ login) — `/stats` จะพังจนกว่าจะ apply |
| 2.2 batch categorize | ✅ ทำแล้ว | endpoint รับทั้ง single และ `{ items }`, มี memo cache ฝั่ง server |
| 3.1 worker OCR/QR | ✅ ทำแล้ว | `src/lib/workers/slipWorker.ts` + fallback เดิมเมื่อไม่มี OffscreenCanvas; ต้องตั้ง `worker.format = 'es'` ใน vite config |
| 3.2 fonts | ✅ ทำแล้ว | self-host subset ใน `static/fonts/`, preload เฉพาะ weight 400 ของ Inter + Noto Sans Thai |
| 3.3 จุกจิก | ◐ บางส่วน | filter signature, basicSsl guard, ลบ console.log แล้ว; `select('*')` ปล่อยไว้ (ตาราง expenses ไม่มี blob column) และ countUp รอวัดจริงก่อนตามที่แผนบอก |

**ค้างอยู่ 2 อย่างที่ต้องใช้สิทธิ์ที่ agent ไม่มี:** migrate JWT signing keys (ข้อ 1.2) และ apply migration ของข้อ 2.1

---

## Phase 1 — Quick wins (~1–2 ชม., ผลใหญ่สุด)

### 1.1 ลบ Supabase browser client ที่ไม่มีใครใช้ (~150 KB ทุกหน้า) — ✅

**ปัญหา:** `src/routes/+layout.ts` สร้าง `createBrowserClient(...)` แล้ว return `{ supabase }` แต่ไม่มีไฟล์ `.svelte` ไหนใช้ `data.supabase` เลย (auth ทั้งหมดวิ่งผ่าน server hooks + cookie อยู่แล้ว) ทำให้ gotrue/postgrest/realtime ~203 KB ถูก bundle เข้า layout node 0 และโหลดทุกหน้า รวมหน้า `/login`.

**ที่ทำ:** ลบ `src/routes/+layout.ts` และ `src/lib/supabaseClient.ts` (ยืนยันด้วย grep ว่าไม่มีใคร import และไม่มี `invalidate('supabase:auth')` ที่ไหน).

**ผลวัดจริง:** `.svelte-kit/output/client/_app/immutable/nodes/` รวม 608 KB → 256 KB, node 0 หลุดจาก 202,954 bytes.

### 1.2 ตัด network round-trip `getUser()` ทุก request (100–300 ms/request) — ⛔ blocked

**ปัญหา:** `src/hooks.server.ts:24-26` await `supabase.auth.getUser()` ก่อนทุก page load / `__data.json` / `/api/*` — เป็น HTTP call ไป Supabase Auth server ทุกครั้ง.

**แนวทาง:** verify JWT ในเครื่องด้วย `getClaims()` (supabase-js >= 2.86 มีแล้ว, ใช้ asymmetric JWT / JWKS cache ได้) แทน `getUser()`.

**ทำไมยังไม่ทำ:** `curl https://<project>.supabase.co/auth/v1/.well-known/jwks.json` ตอบ `{"keys":[]}` แปลว่าโปรเจกต์ยังเซ็น token ด้วย legacy HS256 shared secret. ในสภาพนี้ `getClaims()` จะ fallback ไปเรียก `getUser()` ทาง network อยู่ดี — เปลี่ยนโค้ดไปก็ไม่ได้อะไร แถมเพิ่มความเสี่ยง.

**ขั้นตอนเมื่อพร้อม:**
1. Supabase dashboard: Project Settings → API → JWT ต้องเป็น **asymmetric signing keys** (ECC/RSA). กด migrate ตอน traffic ต่ำ, token เก่ายังใช้ได้จน expiry. ยืนยันว่า JWKS ไม่ว่างแล้ว.
2. แก้ `hooks.server.ts`:
   ```ts
   const { data: claimsData } = await event.locals.supabase.auth.getClaims();
   const claims = claimsData?.claims ?? null;
   event.locals.user = claims
       ? ({ id: claims.sub, email: claims.email } as any)
       : null;
   event.locals.session = claims ? ({ user: event.locals.user } as any) : null;
   ```
   `getClaims()` verify signature local ผ่าน JWKS (cache ใน memory) — ไม่มี network hop หลัง JWKS ครั้งแรก. Refresh token flow ยังทำงานอัตโนมัติผ่าน `createServerClient` cookie handlers เดิม.
3. เช็คทุกจุดที่ใช้ `locals.user` — grep `locals.user` — ถ้ามีที่ใช้ field อื่นนอกจาก `id`/`email` (เช่น `user_metadata`) ให้ดึงจาก claims เพิ่ม.
4. ทดสอบ: login, refresh หน้า, ปล่อย token หมดอายุ (ลด maxAge ชั่วคราว) แล้วดูว่า refresh flow ยัง redirect ถูก, `/api/*` ตอบ 401 เมื่อไม่มี session.

**หมายเหตุความปลอดภัย (สำคัญ, อ่านก่อนทำ):** `getClaims()` แบบ asymmetric ยัง verify ลายเซ็นจริง จึงปลอดภัยเทียบเท่า `getUser()` สำหรับ authentication. แต่ token ที่ถูก revoke (user ถูกแบน/ลบ) จะยังผ่านจนหมดอายุ access token (~1 ชม. default). แอปนี้เป็นกลุ่มผู้ใช้เล็ก ยอมรับได้; ถ้าต้องการ revoke ทันที ให้คง `getUser()` เฉพาะ route อ่อนไหว (เช่น `/settings`, MFA).

**Acceptance:** TTFB ของ `__data.json` ลดลงเห็นชัด (วัดด้วย devtools Network ก่อน/หลัง), auth flow ครบทุกเคส.

### 1.3 Lazy-load layerchart หน้า `/stats` (~500 KB ออกจาก preload path) — ✅

**ปัญหา:** `src/routes/stats/+page.svelte:3` — `import { PieChart, BarChart } from "layerchart"` แบบ static ดึง chunk 371 KB + บริวารอีก ~130 KB. `app.html` ตั้ง `data-sveltekit-preload-data="hover"` — แค่ hover แท็บก็เริ่มโหลดครึ่ง MB.

**ที่ทำ:** โหลดใน `onMount` ด้วย dynamic import แล้ว render ผ่าน `<svelte:component>` (ไฟล์นี้ยังเป็น legacy mode ไม่ใช่ runes) มี skeleton สูงเท่ากราฟจริง (`h-56` / วงกลม `h-52 w-52`) กัน CLS.

**ผลวัดจริง:** node ของ `/stats` = 12,479 bytes และ chunk ใหญ่ (678 KB) ถูกอ้างผ่าน `import("../chunks/…")` เท่านั้น.

### 1.4 บีบไอคอน PNG + แคบ service worker precache (~1 MB แรกเข้า) — ✅

**ปัญหา:** ไอคอนรวม ~1.1 MB (`icon-maskable-512.png` = 641 KB!) และ `src/service-worker.ts:10` precache ทุกอย่าง (`[...build, ...files]`) ตอน install แย่ง bandwidth กับ first paint.

**ที่ทำ:**
1. `pngquant --quality=60-85` ทุกไอคอน: 1.12 MB → 83 KB (maskable-512: 641 KB → 27 KB).
2. เพิ่ม `favicon-32.png` (686 bytes) แล้วให้ `app.html` ชี้ไปที่นั่นแทน `icon-192.png`.
3. `service-worker.ts`: `PRECACHE = [...build]`, `RUNTIME_CACHEABLE = new Set(files)` แล้ว `cache.put` ตอน fetch สำเร็จ.

**Acceptance:** first visit (SW ใหม่) transfer รวมลดลง ~1 MB, offline ยังทำงาน. ← ยังไม่ได้ยืนยันบนเบราว์เซอร์จริง (DevTools → Application → Service Workers → unregister แล้วโหลดใหม่)

---

## Phase 2 — Data layer (~ครึ่งวัน)

### 2.1 ย้าย stats aggregation ลง Postgres RPC — ⚠️ โค้ดพร้อม รอ apply migration

**ปัญหา:** `src/routes/stats/+page.server.ts` ดึง expense **ทุกแถว** ในช่วง (range=all คือทั้งตาราง) มา sum ใน JS — payload และเวลาโตเชิงเส้นตามข้อมูล.

**ที่ทำ:**
1. `supabase/migrations/20260802_stats_aggregate.sql` — `get_expense_stats(p_project_id uuid, p_start timestamptz)` คืน jsonb ก้อนเดียว (`total`, `count`, `earliest`, `monthly`, `by_category`, `by_spender`) + index `expenses_expense_paid_at_idx` แบบ partial บน `transaction_type = 'expense'`. เขียนตาม pattern ของ `get_expense_list_summary` เดิม (`LANGUAGE sql STABLE`, security invoker เป็นค่า default ของ Postgres, มี GRANT ท้ายไฟล์).
2. `+page.server.ts` เรียก RPC แล้วเหลือแค่งาน presentation — bucket เดือนต่อเนื่องใช้ `earliest` จาก RPC, ส่วนการเรียงลำดับยังทำใน JS ด้วย `localeCompare('th')` ตัวเดิมเป๊ะ เพื่อไม่ให้ collation ของ DB เปลี่ยนลำดับ.
3. month key ใช้ `to_char(paid_at, 'YYYY-MM')` ใน session timezone ของ DB (UTC) ซึ่งตรงกับที่ JS เดิมได้บน app server ที่เป็น UTC.

**ต้องทำต่อ (คนที่มีสิทธิ์):**
```bash
supabase login && supabase link --project-ref hmsqapwbftxlxzxybnyu
supabase db push          # หรือ apply ไฟล์ 20260802_stats_aggregate.sql ผ่าน dashboard SQL editor
```
แล้วเทียบตัวเลข total/count/breakdown ทุก range × project filter กับของเดิม. **อย่า deploy โค้ดนี้ก่อน apply migration** ไม่งั้น `/stats` จะว่างเปล่า.

**Acceptance:** payload `/stats` จากหลาย KB–MB เหลือ <5 KB คงที่, ตัวเลขตรงกับของเดิมทุก filter.

### 2.2 Batch AI categorize ใน bulk scan — ✅

**ปัญหา:** `src/routes/expenses/bulk/+page.svelte` เรียก `/api/categorize` ทีละสลิป — N DeepSeek round-trips + N ครั้งของ auth ใน hooks.

**ที่ทำ:**
1. `/api/categorize` รับเพิ่ม `{ items: [{ id, transactionType, description, notes }] }` ตอบ `{ results: [{ id, category }] }` จาก DeepSeek prompt เดียว (ตอบเป็น JSON array) — shape เดิมแบบ single ยังใช้ได้สำหรับฟอร์มปกติ.
2. memo cache ระดับ module (`Map`, จำกัด 500 entry) key = ประเภท+รายละเอียด+หมายเหตุ — สลิปร้านเดิมไม่ต้องยิงซ้ำ.
3. ฝั่ง bulk: keyword match (`inferCategoryFromText`) ทำทันทีตอนสแกนเสร็จแต่ละใบ, ที่เหลือรวบยิงครั้งเดียวหลังสแกนครบทั้งชุด (`categorizePending()`).

**Acceptance:** bulk N สลิป = 1 categorize request. ← ยังไม่ได้ยืนยันบนเบราว์เซอร์จริงกับ 5+ สลิป

---

## Phase 3 — Main thread & polish (~ครึ่งวัน)

### 3.1 ย้าย image preprocessing + QR scan เข้า Web Worker — ✅

**ปัญหา:** `src/lib/utils/imageProcessor.ts` วน pixel ~5.7M × 2 pass บน main thread, `src/lib/utils/slipQr.ts` รัน jsQR สูงสุด 5 รอบ sync. หน้า bulk คูณด้วย CONCURRENCY = UI freeze.

**ที่ทำ:**
1. `src/lib/workers/slipWorker.ts` — รับ `ImageBitmap` (transferable) ทำงานบน `OffscreenCanvas` สองงาน: `prepare` (downscale → JPEG base64 + jsQR ทุก crop) และ `binarize` (grayscale + contrast + adaptive threshold → PNG blob สำหรับ Tesseract).
2. `src/lib/utils/slipWorkerClient.ts` — promise bridge, worker ตัวเดียวใช้ร่วมกัน, correlate ด้วย id, คืน `null` เมื่อเบราว์เซอร์ไม่มี `OffscreenCanvas`/`createImageBitmap` เพื่อให้ `slipClient.ts` ถอยไปใช้ path เดิมได้.
3. `vite.config.ts` ต้องตั้ง `worker: { format: 'es' }` — worker code-split `jsqr` ซึ่ง iife (ค่า default) ไม่รองรับ.
4. ลบ `console.log` ใน `imageProcessor.ts` แล้ว.

**Acceptance:** DevTools Performance ระหว่าง bulk scan ไม่มี long task >200 ms จาก image loop บน main thread. ← ยังไม่ได้วัดบนอุปกรณ์จริง (CPU throttle 4x)

### 3.2 Fonts — ✅

**ปัญหา:** `src/app.html` โหลด 3 families 10 weights จาก Google Fonts เป็น blocking stylesheet cross-origin.

**ที่ทำ:** ดึง woff2 subset เฉพาะ latin / latin-ext / thai ลง `static/fonts/` (Noto Sans Thai เก็บเฉพาะ subset thai เพราะ latin มี Inter คุมอยู่แล้ว), ประกาศ `@font-face` ทั้ง 16 บล็อกไว้บนสุดของ `src/app.css` พร้อม `font-display: swap`, preload เฉพาะ `inter-400-latin` กับ `noto-sans-thai-400-thai`, แล้วลบ `<link>` Google Fonts + preconnect ออก. ทั้งสามตระกูลยังใช้จริง (Inter = body, Outfit = heading/ตัวเลขเงิน, Noto Sans Thai = ภาษาไทย) จึงไม่ยุบ.

**Acceptance:** ไม่มี request ไป fonts.googleapis.com ✅ (ยืนยันจาก build output + dev server), ข้อความไทยไม่ FOUT นาน ← ยังไม่ได้ดูด้วยตา

### 3.3 จุกจิก — ◐

| จุด | สถานะ |
| --- | --- |
| `expenses/+page.svelte` — `JSON.stringify(page.filters)` ทุก pass | ✅ เปลี่ยนเป็น `filterSignature()` ที่ join field คงที่; `dateGroups` derive จาก `visibleExpenses` อยู่แล้ว |
| `src/lib/actions/countUp.ts` — rAF write `textContent` หลาย element | ⏸ คงไว้ตามแผน (วัดก่อนค่อยแก้ ยังไม่เห็น jank ที่พิสูจน์ได้) |
| `vite.config.ts` — `basicSsl()` ไม่ guard | ✅ `...(mode === 'development' ? [basicSsl()] : [])` |
| `select('*')` ใน `[id]/+page.server.ts`, `[id]/edit/+page.server.ts` | ⏸ ไม่แก้ — schema ของ `expenses` ไม่มี blob column เลย (ทุกคอลัมน์เป็น scalar/text สั้น) ระบุ column เองได้กำไรเกือบศูนย์ แต่เสี่ยงหน้า detail/edit พังเพราะทั้งสองหน้า spread ทั้งแถว |

---

## การวัดผล (ทำก่อนเริ่ม + หลังจบทุก phase)

```bash
npm run build
# ขนาด client bundle ต่อ node
ls -laS .svelte-kit/output/client/_app/immutable/nodes/
ls -laS .svelte-kit/output/client/_app/immutable/chunks/ | head -10
```

Baseline vs หลัง Phase 1–3 (วัดแล้ว):

| ตัวชี้วัด | ก่อน | หลัง |
| --- | --- | --- |
| client nodes รวม | 608 KB | 256 KB |
| layout node 0 | 203 KB | หลัก KB |
| node ของ `/stats` | ดึง chunk 371 KB + 130 KB ตอน preload | 12.5 KB, chart โหลดทีหลัง |
| ไอคอนใน `static/` | 1.12 MB | 83 KB |
| SW precache | build + files ทั้งหมด | build อย่างเดียว |

ยังไม่ได้วัด (ต้องใช้เบราว์เซอร์จริง):

- Lighthouse (mobile, throttled) บนหน้า `/`, `/expenses`, `/stats` — FCP/LCP/TBT/transfer
- DevTools Network: TTFB ของ `__data.json` ตอน navigate (ข้อ 1.2 — รอ migrate JWT ก่อน)
- DevTools Performance + CPU 4x throttle ระหว่าง bulk scan (ข้อ 3.1)

## ลำดับ commit

แยก commit ต่อข้อ, revert ได้เดี่ยวๆ:

```
0293341 perf: drop unused Supabase browser client from the root layout      (1.1)
807c608 perf: lazy-load layerchart on /stats                                (1.3)
1056a21 perf: compress PWA icons and narrow service worker precache         (1.4)
e3f0465 perf: aggregate stats in Postgres instead of summing rows in JS     (2.1)
16fcf1d perf: batch AI categorization for bulk slip scans                   (2.2)
8bddcc9 perf: move slip preprocessing and QR decoding into a worker         (3.1 + 3.3)
645d388 perf: self-host font subsets instead of loading Google Fonts        (3.2)
```

ทุก commit ผ่าน `npm run check` (0 errors), `npx vitest run` (32 tests), และ `npm run build`.
