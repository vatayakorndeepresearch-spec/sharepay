# Slip OCR Improvement Plan

> **Goal:** Replace the inaccurate client-side Tesseract.js pipeline with a server-side, AI-powered slip extraction service that reads Thai bank slips (SCB, KBank/K+, KKP, and others) with near-perfect accuracy for **amount, date, memo, sender/receiver, and transaction reference**.
>
> **Audience:** This document is written for AI orchestration to implement autonomously. Each phase has explicit file paths, schemas, prompts, and acceptance criteria. Phases are ordered by dependency; Phase 2 is the core accuracy fix.

---

## 1. Current State (verified from codebase + production data)

### 1.1 Architecture today

```
User picks image (expenses/new, expenses/bulk, expenses/[id]/edit)
  └─> preprocessImage()            src/lib/utils/imageProcessor.ts   (canvas grayscale + binarization)
  └─> Tesseract.js worker 'tha+eng' src/lib/stores/ocrStore.ts       (runs in browser)
  └─> extractExpenseData(text)      src/lib/utils/expenseForm.ts     (regex line parsing)
  └─> fills amount / paidAt / notes / description → AI categorize via /api/categorize (DeepSeek)
```

Slip images are uploaded server-side to Supabase Storage bucket **`expense_proofs`** (public), path `uploads/<timestamp>_<rand>.<ext>`, stored on `expenses.proof_image_url` and in `expense_attachments`. As of 2026-08-01 there are **100+ slip images in production** — use them as the evaluation dataset (Phase 0).

### 1.2 Why accuracy is bad (root causes, confirmed by inspecting real slips)

Real production slips inspected from the `expense_proofs` bucket:

| Slip type | Layout traits | Failure mode with current pipeline |
|---|---|---|
| **SCB app slip** | Decorative purple/pink illustrated background, patterned watermark behind text, Thai labels (`จำนวนเงิน`, `บันทึกช่วยจำ`), Buddhist year (`30 ก.ค. 2569`), amount right-aligned on the label line | Global binarization in `imageProcessor.ts` merges the patterned background into the text; Tesseract Thai output is garbage. |
| **K+ (KBank) slip** | Cleaner layout but has a building watermark texture; `1 ส.ค. 69` short-year date; `จำนวน: 11,000.00 บาท`; memo on last line `บันทึกช่วยจำ: ...` | Thai diacritics (vowel/tone marks) frequently misread; month abbreviations garble — evidence: the workaround map in `expenseForm.ts` (`'5m': 12, 'sm': 12, 's.m': 12 …`) exists purely to decode Tesseract's mangling of `ธ.ค.`/`ม.ค.` etc. |
| **KKP slips** | Similar structure (KKP Dime / KKP mobile), Thai labels | Same Thai OCR failures. |
| **Non-slip screenshots** | e.g. PTT EV charging app history screenshot — no `จำนวนเงิน` label at all, amount as `236.68 บาท` in list layout | Regex parser has no anchor; extracts wrong number or nothing. |

Conclusions:

1. **Tesseract.js is the bottleneck.** Thai script + decorative slip backgrounds is a known worst case. No amount of regex tuning fixes upstream garbage text.
2. **Every real bank slip carries a verification QR code** (มินิ QR / `สแกนตรวจสอบสลิป`) containing the transaction reference in EMV-TLV format — currently completely unused. It is deterministic, free, and enables dedupe.
3. There is already a working DeepSeek key and `/api/categorize` server route, so the project already has the pattern for server-side AI calls.

### 1.3 Constraints

- Hosting: **Vercel** (SvelteKit) + **Supabase** (Postgres, Storage, Edge Functions available).
- Existing secrets: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `DEEPSEEK_API_KEY`. DeepSeek has **no vision model** on its public API — a vision-capable provider must be added.
- No GPU self-hosting. Any "open-source model" must be consumed through a hosted API.
- Must keep working offline-ish: if the AI endpoint fails, degrade gracefully (keep the Tesseract path as fallback, not delete it in Phase 2).

---

## 2. Target Architecture

```
Client (new/bulk/edit pages)
  ├─ 1. downscale image to ≤1600px, JPEG q0.85          (client, cheap)
  ├─ 2. decode slip QR with jsQR → transRef + bank hint  (client, deterministic)
  └─ 3. POST /api/slip-extract  { imageBase64, qrPayload? }
            │  (SvelteKit server route on Vercel, auth required)
            ├─ Provider A (primary): Typhoon OCR (SCB10X, open-source Thai document model,
            │                        hosted at api.opentyphoon.ai, OpenAI-compatible)
            │        image → markdown/text  →  DeepSeek chat (existing key) → structured JSON
            ├─ Provider B (alternative, single call): OpenRouter multimodal
            │                        (google/gemini-2.5-flash class) image → structured JSON
            └─ zod-validate → normalize (Buddhist→Gregorian, comma amounts) → return
  └─ 4. Fill form fields, highlight, trigger /api/categorize as today
  └─ 5. On save: persist extraction row to slip_extractions (audit + dedupe via transRef)

Fallback chain: /api/slip-extract error/timeout (>12s) → existing Tesseract client path → manual entry.
```

Provider choice is behind an interface + env var so both can be implemented and A/B compared with the Phase 0 eval harness. **Recommendation: implement Provider A first** (Typhoon OCR is open-source, Thai-specialized — trained by SCB10X specifically for Thai documents — and pairs with the DeepSeek key that already exists; structuring cost is negligible). Provider B is a ~30-line variant worth adding for comparison.

---

## 3. Phase 0 — Evaluation harness & golden dataset (do this first)

**Why first:** without a measurable baseline, "better" is a guess. All later phases are gated on eval numbers.

### Tasks

1. **`scripts/fetch-slips.mjs`** — Node script. Lists `expense_proofs/uploads` via Supabase Storage API (bucket is public; anon key in `.env` is sufficient), downloads the ~100 most recent images to `eval/slips/` (gitignored).
2. **`eval/golden.jsonl`** — ground-truth labels for **at least 40 slips**, covering: SCB transfer, SCB bill payment, K+ transfer, KKP, at least 3 non-slip screenshots, at least 2 blurry/cropped photos. One JSON object per line:

   ```json
   {"file": "1785570365917_yhkzqt.jpeg", "is_slip": true, "bank": "SCB", "amount": 200.00, "date": "2026-07-30", "time": "21:03", "memo": "ชำระค่าห้องที่ค้างอยู่", "sender_name": "นาย วาทยากร จ.", "receiver_name": "นางสาว เกษร รามมะเริง", "trans_ref": "202607304ZLhuJFqU8Cf6ChkK"}
   ```

   Labels may be produced with a vision model then **human-spot-checked** — do not trust unreviewed model labels for the golden set.
3. **`scripts/eval-ocr.mjs`** — runs a named pipeline (`tesseract` | `typhoon` | `openrouter`) over `eval/slips/`, compares to golden, prints a table:
   - `amount_acc` (exact match), `date_acc` (exact ISO match), `memo_acc` (normalized Levenshtein ≥ 0.85), `trans_ref_acc`, `non_slip_rejection` (correctly returns `is_slip:false`).
4. Record the **Tesseract baseline** numbers in `eval/RESULTS.md` before touching anything else.

### Acceptance criteria

- Baseline table exists in `eval/RESULTS.md`.
- `golden.jsonl` ≥ 40 labeled rows, all four bank/slip types + negatives represented.

---

## 4. Phase 1 — QR decoding (deterministic quick win, no new backend)

Every Thai bank slip QR encodes an EMV-TLV payload ("mini-QR") whose tag `00` sub-structure contains the **sending-bank code and transaction reference**. Decoding it costs nothing and is 100% reliable when the QR is readable.

### Tasks

1. `npm i jsqr` (client-side, ~40KB).
2. **`src/lib/utils/slipQr.ts`** — new module:
   - `decodeSlipQr(canvasImageData): string | null` — run jsQR on the (non-binarized!) downscaled image; retry on 2× upscaled bottom-right / bottom-left crops (QR position varies per bank) before giving up.
   - `parseSlipMiniQr(payload: string): { bankCode: string; transRef: string } | null` — EMV-TLV parse: iterate `[2-digit tag][2-digit length][value]`; tag `00` value is itself TLV: sub-tag `00` = API ID (`000001`), sub-tag `01` = sending bank code (3 digits, e.g. `014` SCB, `004` KBank, `069` KKP), sub-tag `02` = transaction reference. Return null on any malformed structure.
   - `BANK_CODES` map: `004 → KBANK`, `014 → SCB`, `069 → KKP`, `002 → BBL`, `006 → KTB`, `025 → BAY`, `011 → TTB`, `030 → GSB`, `073 → LHB`, `024 → UOBT`, `067 → TISCO`, `071 → TCD`, `022 → CIMBT`, `070 → ICBCT`, `034 → BAAC`, `033 → GHB`.
3. Wire into `processOCR` on all three pages: QR result (bank, transRef) is merged into the extraction result and later persisted (Phase 3). QR **does not** contain the amount — it complements, not replaces, Phase 2.

### Acceptance criteria

- Unit tests for `parseSlipMiniQr` with real payload fixtures (take 3+ from eval slips) + malformed inputs.
- Eval: `trans_ref_acc ≥ 0.9` on golden slips whose QR is legible.

---

## 5. Phase 2 — Server-side AI extraction (the core fix)

### 5.1 New endpoint

**`src/routes/api/slip-extract/+server.ts`** (SvelteKit, runs on Vercel Node runtime — same pattern as `/api/categorize`):

- **Auth:** reject unauthenticated sessions (reuse the app's Supabase SSR session check from existing server routes). This endpoint spends money — never leave it open.
- **Request:** `{ imageBase64: string, mimeType: 'image/jpeg'|'image/png'|'image/webp', qrPayload?: { bankCode, transRef } }`. Reject payloads > 4 MB after base64 decode; reject non-image MIME.
- **Response:** the `SlipExtraction` object below, or `{ error }` with proper status codes (`400` bad input, `401` unauth, `422` model could not extract, `504` provider timeout).
- **Timeout:** abort provider call at 12 s (`AbortController`); client falls back to Tesseract.

### 5.2 Shared schema

**`src/lib/types/slip.ts`**:

```ts
import { z } from 'zod'; // add zod dependency

export const SlipExtractionSchema = z.object({
    is_slip: z.boolean(),                      // false for random screenshots → client skips autofill
    bank: z.enum(['SCB','KBANK','KKP','BBL','KTB','BAY','TTB','GSB','OTHER','UNKNOWN']),
    direction: z.enum(['transfer_out','transfer_in','bill_payment','topup','unknown']),
    amount: z.number().positive().nullable(),
    fee: z.number().min(0).nullable(),
    currency: z.literal('THB').default('THB'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),   // ISO, Gregorian (already converted)
    time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
    sender: z.object({ name: z.string().nullable(), account: z.string().nullable() }),
    receiver: z.object({ name: z.string().nullable(), account: z.string().nullable() }),
    memo: z.string().nullable(),               // บันทึกช่วยจำ
    trans_ref: z.string().nullable(),
    confidence: z.enum(['high','medium','low'])
});
export type SlipExtraction = z.infer<typeof SlipExtractionSchema>;
```

### 5.3 Provider abstraction

**`src/lib/server/slipProviders/`**:

- `index.ts` — `extractSlip(image, mime, hints): Promise<SlipExtraction>`; picks provider from `env.SLIP_AI_PROVIDER` (`'typhoon'` default | `'openrouter'`).
- `typhoon.ts` — **Provider A (primary).** Two-step:
  1. POST `https://api.opentyphoon.ai/v1/chat/completions` (OpenAI-compatible), model `typhoon-ocr-preview`, image as `image_url` data URI, task prompt per Typhoon OCR docs → returns faithful markdown/text of the slip. Env: `TYPHOON_API_KEY` (free tier available at opentyphoon.ai; model is open-source `scb10x/typhoon-ocr-7b` so the provider can later be swapped to any host serving it).
  2. POST DeepSeek (`deepseek-chat`, existing key, `response_format: {type:'json_object'}`) with the structuring prompt (5.4) over the OCR text → JSON.
- `openrouter.ts` — **Provider B.** Single call: POST `https://openrouter.ai/api/v1/chat/completions`, model from `env.OPENROUTER_MODEL` (default `google/gemini-2.5-flash`), image + structuring prompt combined, JSON response format. Env: `OPENROUTER_API_KEY`.
- Both must: validate with `SlipExtractionSchema.safeParse`, apply the normalizer (5.5), and never throw raw provider errors upward (map to typed errors).

### 5.4 Structuring prompt (shared, keep in `src/lib/server/slipProviders/prompt.ts`)

```
You extract data from Thai bank transfer slips (สลิปโอนเงิน).
Return ONLY a JSON object with keys:
is_slip, bank, direction, amount, fee, currency, date, time, sender{name,account}, receiver{name,account}, memo, trans_ref, confidence.

Rules:
- Thai labels: "จำนวนเงิน"/"จำนวน" = amount (THB). "ค่าธรรมเนียม" = fee. "บันทึกช่วยจำ" = memo.
  "จาก" = sender. "ไปยัง"/"ถึง" = receiver. "รหัสอ้างอิง"/"เลขที่รายการ" = trans_ref.
- Dates are Thai Buddhist Era: subtract 543 to get Gregorian year. Short years: "69" or "2569" → 2026.
  Thai month abbreviations: ม.ค.=01 ก.พ.=02 มี.ค.=03 เม.ย.=04 พ.ค.=05 มิ.ย.=06 ก.ค.=07 ส.ค.=08 ก.ย.=09 ต.ค.=10 พ.ย.=11 ธ.ค.=12.
  Output date as YYYY-MM-DD (Gregorian).
- amount: number without commas. Never confuse fee (often 0.00) with amount.
- If the image is NOT a bank slip (e.g. app screenshot, receipt, photo), set is_slip=false and all other
  fields null/unknown, but still try amount/date/memo if a payment amount is clearly visible.
- Keep Thai names exactly as printed. Do not translate.
- confidence: high = all key fields crisp; medium = some inferred; low = blurry/partial.
```

### 5.5 Normalizer (`src/lib/server/slipProviders/normalize.ts`)

Pure functions + unit tests:

- `normalizeAmount(s)` — strips commas/`บาท`, parses float.
- `toGregorianDate(day, monthToken, yearToken)` — port of the existing logic in `expenseForm.ts:parseDate` **minus the garbled-OCR heuristics** (the `'5m'`-style map dies here; model output is clean). BE→CE: `>2500 → −543`; 2-digit year `≥ 40 → 25xx−543`, else `20xx`.
- Cross-checks: if `qrPayload.transRef` present and model `trans_ref` disagrees → trust QR. If `qrPayload.bankCode` maps to a bank and model says `UNKNOWN` → use QR bank.
- Reject `date` outside `[today − 2 years, today + 1 day]` → null (forces client to default to today, current behavior).

### 5.6 Client integration

- **`src/lib/utils/slipClient.ts`** — new: `extractFromImage(file): Promise<SlipExtraction>`:
  1. Downscale to ≤1600px long edge, JPEG q0.85, on canvas (reuse resize logic from `imageProcessor.ts`, **without** binarization — binarization is only for the Tesseract fallback).
  2. `decodeSlipQr` (Phase 1).
  3. POST `/api/slip-extract`.
  4. On network/5xx/timeout: fall back to existing `preprocessImage` + Tesseract + `extractExpenseData`, mapped into a `SlipExtraction` with `confidence:'low'`.
- **`src/routes/expenses/new/+page.svelte`** — `processOCR` now calls `extractFromImage`; field mapping:
  - `amount ← extraction.amount`, `paidAt ← extraction.date`
  - `notes ← memo` (fallback: `direction==='bill_payment' ? receiver.name : memo`), `description ← memo ?? receiver.name`
  - if `is_slip === false && amount == null`: show a subtle toast "อ่านสลิปไม่สำเร็จ กรอกเองได้เลย" instead of silently doing nothing.
  - keep `flashHighlights` + AI categorize trigger exactly as today.
- **`src/routes/expenses/[id]/edit/+page.svelte`** — same swap.
- Loading UX: keep the existing `กำลังอ่านสลิป` indicator; server round-trip is 2–8 s, so also disable re-submission of the same file while in flight.

### Acceptance criteria

- Eval (Phase 0 harness) on the chosen primary provider: **amount ≥ 95%, date ≥ 90%, memo ≥ 85%, non-slip rejection ≥ 90%** — all strictly better than the recorded Tesseract baseline.
- `/api/slip-extract` returns 401 without a session; handles a 5 MB upload with 400; survives provider 500 with a clean 504/422.
- Unit tests: normalizer (BE dates incl. `2569`, `69`, full Thai month names), schema rejection of malformed model output.
- `npm run check` passes.

---

## 6. Phase 3 — Persistence, dedupe, audit

### 6.1 Migration `supabase/migrations/<date>_slip_extractions.sql`

```sql
create table if not exists public.slip_extractions (
    id uuid primary key default gen_random_uuid(),
    expense_id uuid references public.expenses(id) on delete cascade,
    storage_path text not null,
    provider text not null,                  -- 'typhoon' | 'openrouter' | 'tesseract-fallback'
    model text,
    extraction jsonb not null,               -- full SlipExtraction object
    trans_ref text,
    bank text,
    confidence text,
    created_at timestamptz not null default now(),
    created_by uuid references auth.users(id) default auth.uid()
);
create index on public.slip_extractions (trans_ref) where trans_ref is not null;
alter table public.slip_extractions enable row level security;
-- RLS: same visibility model as expenses (mirror existing expenses policies).
```

### 6.2 Tasks

- On expense save (`expenses/new/+page.server.ts` action): client posts the extraction JSON in a hidden form field; server inserts the `slip_extractions` row linked to the created expense + uploaded storage path. Never block expense creation on this insert (log-and-continue).
- **Dedupe:** before autofill on the client, `/api/slip-extract` response includes `duplicate_of` — the server checks `trans_ref` against `slip_extractions` (query with the user's session so RLS scopes it). If a match: client shows warning "สลิปนี้เคยถูกบันทึกแล้ว" with a link to the existing expense, but does not hard-block.
- This table doubles as a **free-flowing eval set**: every production extraction is auditable, and mislabeled ones become new golden rows.

### Acceptance criteria

- Migration applies cleanly; RLS verified (user A cannot read user B's extraction rows) — test via two anon sessions or SQL role simulation.
- Uploading the same slip twice produces the dedupe warning.

---

## 7. Phase 4 — Bulk upload page

`src/routes/expenses/bulk/+page.svelte` currently loops files sequentially through Tesseract.

- Swap the per-file pipeline to `extractFromImage` (Phase 2 client util).
- Concurrency: process **3 files at a time** (simple promise pool) — protects provider rate limits (Typhoon free tier is rate-limited) and keeps the UI responsive.
- Per-row status chips: `queued → reading → done/failed(fallback)/duplicate`, reusing the dedupe signal.
- On provider 429: exponential backoff (1s, 4s, 10s), then Tesseract fallback for that file only.

### Acceptance criteria

- 10-file batch completes with mixed slip types; failures degrade per-file, never abort the batch.

---

## 8. Phase 5 — Rollout, flags, cost & monitoring

- **Feature flag:** `PUBLIC_SLIP_AI_ENABLED` (client checks; when `false` everything behaves exactly as today). Ship dark, verify in prod with own uploads, then enable.
- **Env additions** (Vercel project settings + `.env.example`):

  ```
  SLIP_AI_PROVIDER=typhoon          # typhoon | openrouter
  TYPHOON_API_KEY=
  OPENROUTER_API_KEY=               # optional, provider B
  OPENROUTER_MODEL=google/gemini-2.5-flash
  PUBLIC_SLIP_AI_ENABLED=true
  ```

- **Cost envelope:** a downscaled slip ≈ 500–900 image tokens. Flash-class via OpenRouter ≈ $0.0002–0.001/slip; Typhoon OCR free tier covers this app's volume (~100 slips/month observed); DeepSeek structuring step ≈ $0.0001/slip. Even at 10× volume, < $1/month.
- **Logging:** server logs `provider, model, latency_ms, confidence, is_slip, had_qr` — never log names, accounts, memo, or image data.
- **Run the eval one final time** on both providers; record in `eval/RESULTS.md`; set the winner as default `SLIP_AI_PROVIDER`.
- Cleanup after 2 weeks stable: remove binarization-for-AI paths but **keep** `imageProcessor.ts` + `ocrStore.ts` for the offline fallback. Delete the garbled-month map from `expenseForm.ts` only if the Tesseract fallback is later removed entirely.

---

## 9. Explicitly out of scope (documented decisions)

- **Slip verification against the bank (SlipOK / EasySlip / Bank open APIs):** paid third-party services that verify a transRef is a real transaction. Not needed for a personal expense tracker; the QR transRef dedupe covers the practical risk. Revisit only if the app becomes multi-tenant expense splitting with settlement.
- **Self-hosting `scb10x/typhoon-ocr-7b` on a GPU:** the model is open-source and this stays possible (the provider interface isolates it), but Vercel/Supabase cannot host it. Hosted API is the right call at this scale.
- **Training/fine-tuning a custom slip model:** unjustified at ~100 slips/month.

---

## 10. Implementation order & task graph (for orchestration)

```
Phase 0  fetch-slips.mjs → golden.jsonl → eval-ocr.mjs → baseline RESULTS.md
Phase 1  slipQr.ts + tests  ──┐            (independent of Phase 0 after baseline)
Phase 2  slip.ts schema → providers (typhoon, openrouter) + prompt + normalize + tests
         → /api/slip-extract → slipClient.ts → wire new/edit pages → run eval, gate on targets
Phase 3  migration slip_extractions → save-path insert → dedupe check in endpoint → RLS tests
Phase 4  bulk page pool + statuses
Phase 5  flags, env docs, final eval, RESULTS.md, cleanup
```

Parallelizable: Phase 1 ∥ Phase 2 provider work; Phase 3 migration ∥ Phase 2 client wiring. Everything else sequential. Each phase ends with: unit tests green, `npm run check` green, eval numbers not regressed.

### Definition of done (whole feature)

1. Golden-set eval: amount ≥ 95%, date ≥ 90%, memo ≥ 85%, non-slip rejection ≥ 90%, trans_ref ≥ 90% (QR-legible subset).
2. SCB / K+ / KKP slips autofill correctly end-to-end in the new-expense flow on production.
3. Duplicate slip upload warns with a link to the prior expense.
4. AI endpoint authenticated, size-capped, cost-logged; Tesseract fallback demonstrably triggers when the provider key is removed.
