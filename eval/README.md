# Slip extraction evaluation harness

Phase 0 of [docs/OCR_IMPROVEMENT_PLAN.md](../docs/OCR_IMPROVEMENT_PLAN.md).

```bash
npm run eval:fetch                       # download production slips → eval/slips/ (gitignored)
node scripts/qr-scan.mjs                 # decode slip mini-QRs (bank code + trans ref)
npm run eval:ocr -- --pipeline tesseract --out eval/RESULTS.md
npm run eval:ocr -- --pipeline typhoon   --out eval/RESULTS.md   # needs TYPHOON_API_KEY
npm run eval:ocr -- --pipeline openrouter --out eval/RESULTS.md  # needs OPENROUTER_API_KEY
```

## Files

| path | what |
|---|---|
| `slips/` | downloaded production images (gitignored, ~100 files) |
| `golden.jsonl` | ground-truth labels, one JSON object per line |
| `qr-scan.json` | mini-QR decode result per file (payload + parsed bank/ref) |
| `RESULTS.md` | scored runs, appended by `--out` |

## Golden label format

```json
{"file":"1785570365917_yhkzqt.jpeg","is_slip":true,"bank":"SCB","amount":200.00,"date":"2026-07-30","time":"21:03","memo":"ชำระค่าห้องที่ค้างอยู่","sender_name":"นาย วาทยากร จ.","receiver_name":"นางสาว เกษร รามมะเริง","trans_ref":"202607304ZLhuJFqU8Cf6ChkK"}
```

Labels were produced by reading each image with a vision model and spot-checked
against the raw images. They are **not** fully human-reviewed — treat single-row
disagreements as "check the image" rather than "the pipeline is wrong".

## Metrics

- `amount_acc` — exact match (±0.005)
- `date_acc` — exact ISO (Gregorian) match
- `memo_acc` — normalized Levenshtein similarity ≥ 0.85
- `trans_ref_acc` — exact match after whitespace/case normalization
- `non_slip_rejection` — `is_slip:false` returned for non-slip images
