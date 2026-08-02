# Slip OCR — implementation notes

Implements [OCR_IMPROVEMENT_PLAN.md](./OCR_IMPROVEMENT_PLAN.md). This file records what shipped,
how to operate it, and what still needs a key/human before the plan's definition of done is met.

## Pipeline

```
client  slipClient.extractFromImage(file)
          downscale ≤1600px JPEG q0.85      src/lib/utils/slipClient.ts
          decode slip mini-QR (jsQR)        src/lib/utils/slipQr.ts
          POST /api/slip-extract            src/routes/api/slip-extract/+server.ts   (auth required)
server      provider = SLIP_AI_PROVIDER     src/lib/server/slipProviders/index.ts    (12s AbortController)
              typhoon:    Typhoon OCR → DeepSeek structuring   (default)
              openrouter: single multimodal call
            normalizeExtraction()           src/lib/server/slipProviders/normalize.ts
            dedupe lookup on trans_ref      → duplicate_of
client    fill form + flashHighlights + /api/categorize (unchanged)
save      hidden field slip_extraction → slip_extractions row (log-and-continue)
```

Fallback chain: any non-429 failure, timeout, or `PUBLIC_SLIP_AI_ENABLED=false`
→ existing Tesseract path (`preprocessImage` + `extractExpenseData`) mapped into a
`SlipExtraction` with `confidence:'low'`, `provider:'tesseract-fallback'`.

Shared pure logic (prompts, amount/date normalizers, EMV-TLV QR parser) lives in
`src/lib/shared/slipCore.js` — plain JS so the SvelteKit app and the Node eval
scripts run *the same* code.

## Environment

```
SLIP_AI_PROVIDER=typhoon          # typhoon | openrouter
TYPHOON_API_KEY=
DEEPSEEK_API_KEY=                 # already used by /api/categorize; also the structuring step
OPENROUTER_API_KEY=               # optional, provider B
OPENROUTER_MODEL=google/gemini-2.5-flash
PUBLIC_SLIP_AI_ENABLED=true       # 'false' ⇒ behaves exactly like before (Tesseract only)
```

Ship dark: set `PUBLIC_SLIP_AI_ENABLED=false` in Vercel first, verify the route with
your own uploads, then flip to `true`.

## Cost & logging

A downscaled slip is ≈500–900 image tokens. OpenRouter Flash-class ≈ $0.0002–0.001/slip;
DeepSeek structuring ≈ $0.0001/slip; Typhoon's free tier covers the observed ~100 slips/month.
Server logs one line per call — `provider, model, latency_ms, confidence, is_slip, had_qr` —
and never names, accounts, memo, or image data.

## Database

`supabase/migrations/20260802_slip_extractions.sql` creates `public.slip_extractions`
(+ partial index on `trans_ref`). RLS mirrors `public.expenses`: this is a shared
household app, so every authenticated user has full access (see `supabase/fix_rls_auth.sql`).
The plan's "user A cannot read user B's rows" criterion does not apply to this app's
visibility model — per-user isolation would diverge from how expenses themselves behave.

**The migration has not been applied yet** (no Supabase admin credentials in this
environment). Until it is applied, the dedupe lookup logs
`[slip-extract] dedupe lookup skipped: …` and returns `duplicate_of: null`, and the
audit insert logs and continues — no user-visible breakage.

## Evaluation

See [eval/README.md](../eval/README.md). Corpus: 100 production slips downloaded
via `npm run eval:fetch`; 49 labeled golden rows (KBANK 36, SCB 4+1, KKP 2, KTB 1,
6 non-slip screenshots).

`node scripts/qr-scan.mjs` decodes the slip mini-QR offline (jimp + jsQR) and parses it
with the same `parseSlipMiniQr` the client uses — that is how the QR fixtures in
`src/lib/shared/slipCore.test.js` were validated against real payloads.

## Open items (need credentials or a human)

1. **Provider keys.** `TYPHOON_API_KEY` / `OPENROUTER_API_KEY` are not set, so the
   typhoon/openrouter eval runs and the accuracy gates (amount ≥95%, date ≥90%,
   memo ≥85%, non-slip rejection ≥90%) cannot be measured yet. Run:
   `npm run eval:ocr -- --pipeline typhoon --out eval/RESULTS.md`.
2. **Apply the migration** to Supabase, then verify the duplicate warning by uploading
   the same slip twice.
3. **Golden labels** were produced by a vision model and spot-checked, not fully
   human-reviewed.
