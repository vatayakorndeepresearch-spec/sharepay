# Slip extraction — evaluation results

Corpus: 100 production slips from `expense_proofs/uploads` (`npm run eval:fetch`).
Golden set: 49 labeled rows — KBANK 36, SCB 5, KKP 2, KTB 1, 6 non-slip screenshots
(PTT EV charging history, app screenshots).

## Phase 1 — QR mini-QR decoding (deterministic, no provider)

`node scripts/qr-scan.mjs --json eval/qr-scan.json` (jimp + jsQR + `parseSlipMiniQr`,
same crop strategy as the client).

| metric | score |
|---|---|
| QR decoded (whole corpus) | 89/100 (89.0%) |
| mini-QR parsed to bank + ref | 89/100 (89.0%) |
| golden slips with a parsed QR | 43/43 (100.0%) |
| **trans_ref exact match vs golden** | **43/43 (100.0%)** |

Target was `trans_ref_acc ≥ 0.9` on QR-legible slips — met. The 11 undecodable images
are the non-slip screenshots and photos, which carry no slip QR.

## Phase 0 — Tesseract baseline (before the AI pipeline)

`node scripts/eval-ocr.mjs --pipeline tesseract`

| metric | score | hits/total |
|---|---|---|
| amount_acc | 63.8% | 30/47 |
| date_acc | 56.5% | 26/46 |
| memo_acc | 79.1% | 34/43 |
| trans_ref_acc | 0.0% | 0/43 |
| non_slip_rejection | 50.0% | 3/6 |
| pipeline_errors | 0 | |

Caveat: the harness feeds Tesseract the raw image, since the production preprocessing
(`imageProcessor.ts`) is canvas-based and browser-only. In the app, binarization helps on
some slips and destroys others (patterned SCB backgrounds), so treat this as a close
approximation of the shipped baseline rather than an exact replay of it.

Typical failure modes seen in the failure list: amount read as `null` (Thai label garbled),
amount read as `7100` where the truth is `100` (watermark bleed), dates dropped entirely,
and every `trans_ref` missed — the reference line is never recovered by OCR, which is
exactly what the QR path fixes.

## Phase 2 — AI providers

Not yet measured: `TYPHOON_API_KEY` / `OPENROUTER_API_KEY` are not configured in this
environment. Once a key is present:

```bash
npm run eval:ocr -- --pipeline typhoon    --out eval/RESULTS.md
npm run eval:ocr -- --pipeline openrouter --out eval/RESULTS.md
```

Gate for shipping the provider as default (from the plan): amount ≥ 95%, date ≥ 90%,
memo ≥ 85%, non-slip rejection ≥ 90%, all strictly better than the baseline above.
