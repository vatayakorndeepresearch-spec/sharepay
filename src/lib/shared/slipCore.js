/**
 * Framework-free core of the slip pipeline: prompts + pure normalizers.
 *
 * Plain JS on purpose — the app (via `$lib`) and the Node eval harness
 * (`scripts/eval-ocr.mjs`) both import this file, so it must not depend on
 * SvelteKit aliases, `$env`, or TypeScript compilation.
 */

export const STRUCTURING_PROMPT = `You extract data from Thai bank transfer slips (สลิปโอนเงิน).
Return ONLY a JSON object with keys:
is_slip, bank, direction, amount, fee, currency, date, time, sender{name,account}, receiver{name,account}, memo, trans_ref, confidence.

Rules:
- bank is one of: SCB, KBANK, KKP, BBL, KTB, BAY, TTB, GSB, OTHER, UNKNOWN. It is the bank whose app
  produced the slip (the sender's app), not the receiver's bank.
  Cues: "K+"/"K PLUS"/"ธ.กสิกรไทย" as sender = KBANK. "SCB"/"ไทยพาณิชย์" = SCB.
  "KKP Better"/"เกียรตินาคินภัทร" = KKP. "ทิสโก้" (TISCO) = OTHER.
- direction is one of: transfer_out, transfer_in, bill_payment, topup, unknown.
  "โอนเงิน"/"โอนเงินสำเร็จ" = transfer_out. "จ่ายบิลสำเร็จ" or a receiver with "Biller ID" = bill_payment.
- Thai labels: "จำนวนเงิน"/"จำนวน" = amount (THB). "ค่าธรรมเนียม" = fee. "บันทึกช่วยจำ" = memo.
  "จาก" = sender. "ไปยัง"/"ถึง" = receiver. "รหัสอ้างอิง"/"เลขที่รายการ" = trans_ref
  (alphanumeric refs are valid; "เลขที่อ้างอิง 1/2/3" and "หมายเลขการชำระเงิน" on bill slips are
  biller references — use them for trans_ref only when no รหัสอ้างอิง/เลขที่รายการ exists).
- Layout notes: some apps (e.g. KKP Better) print the amount only in the coloured header, like
  "โอนเงิน 1,200.00 THB" — that is the amount. A short free-text line at the very bottom of the slip
  with no label (often next to a chat/note icon) is the memo. For bill payments the receiver is the
  biller/shop name and receiver.account may be the Biller ID.
- Accounts are masked ("xxx-x-x3489-x", "xxxxxx6038"); copy them verbatim.
- Dates are Thai Buddhist Era: subtract 543 to get Gregorian year. Short years: "69" or "2569" → 2026.
  Thai month abbreviations: ม.ค.=01 ก.พ.=02 มี.ค.=03 เม.ย.=04 พ.ค.=05 มิ.ย.=06 ก.ค.=07 ส.ค.=08 ก.ย.=09 ต.ค.=10 พ.ย.=11 ธ.ค.=12.
  Output date as YYYY-MM-DD (Gregorian). Output time as HH:MM (24h) or null.
- amount: number without commas. Never confuse fee (often 0.00) with amount.
- If the image is NOT a bank slip (e.g. app screenshot, receipt, photo), set is_slip=false and all other
  fields null/unknown, but still try amount/date/memo if a payment amount is clearly visible.
- Keep Thai names exactly as printed. Do not translate.
- confidence: high = all key fields crisp; medium = some inferred; low = blurry/partial.
- Use null for anything you cannot read. Never invent values.`;

/** Prompt for the Typhoon OCR pass — faithful text, no interpretation. */
export const OCR_PROMPT = `Below is an image of a Thai bank transfer slip. Transcribe every visible line of text
faithfully into markdown, preserving reading order, Thai script, digits, and punctuation exactly as printed.
Do not translate, summarise, or add commentary.`;

/**
 * @param {string} ocrText
 * @param {{ bankCode?: string, transRef?: string }} [hint]
 * @returns {string}
 */
export function buildStructuringUserMessage(ocrText, hint) {
    /** @type {string[]} */
    const hintLines = [];
    if (hint?.bankCode) hintLines.push(`Sending bank code from the slip QR: ${hint.bankCode}`);
    if (hint?.transRef) hintLines.push(`Transaction reference from the slip QR (authoritative): ${hint.transRef}`);

    return `${hintLines.length ? hintLines.join('\n') + '\n\n' : ''}Slip text:\n"""\n${ocrText}\n"""`;
}

/** @type {Record<string, number>} */
export const THAI_MONTHS = {
    'ม.ค.': 1, มกราคม: 1,
    'ก.พ.': 2, กุมภาพันธ์: 2,
    'มี.ค.': 3, มีนาคม: 3,
    'เม.ย.': 4, เมษายน: 4,
    'พ.ค.': 5, พฤษภาคม: 5,
    'มิ.ย.': 6, มิถุนายน: 6,
    'ก.ค.': 7, กรกฎาคม: 7,
    'ส.ค.': 8, สิงหาคม: 8,
    'ก.ย.': 9, กันยายน: 9,
    'ต.ค.': 10, ตุลาคม: 10,
    'พ.ย.': 11, พฤศจิกายน: 11,
    'ธ.ค.': 12, ธันวาคม: 12,
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};

/**
 * "1,234.50 บาท" → 1234.5 ; null when nothing numeric is present.
 * @param {unknown} input
 * @returns {number | null}
 */
export function normalizeAmount(input) {
    if (typeof input === 'number') return Number.isFinite(input) ? input : null;
    if (typeof input !== 'string') return null;

    const cleaned = input.replace(/[,\s]/g, '').replace(/บาท|THB/gi, '');
    const match = cleaned.match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;

    const value = parseFloat(match[0]);
    return Number.isFinite(value) ? value : null;
}

/**
 * @param {string | number} token
 * @returns {number | null}
 */
export function monthFromToken(token) {
    if (typeof token === 'number') return token >= 1 && token <= 12 ? token : null;

    const raw = String(token).trim();
    if (/^\d{1,2}$/.test(raw)) {
        const n = parseInt(raw, 10);
        return n >= 1 && n <= 12 ? n : null;
    }

    const key = raw.toLowerCase();
    if (THAI_MONTHS[key] !== undefined) return THAI_MONTHS[key];

    // Tolerate missing/extra dots in Thai abbreviations ("ก.ค", "กค").
    const stripped = key.replace(/[\s.]/g, '');
    for (const [name, value] of Object.entries(THAI_MONTHS)) {
        if (name.replace(/[\s.]/g, '') === stripped) return value;
    }
    // English long names ("august").
    for (const [name, value] of Object.entries(THAI_MONTHS)) {
        if (name.length === 3 && key.startsWith(name)) return value;
    }

    return null;
}

/**
 * Buddhist-Era or short year token → Gregorian year.
 * @param {string | number} yearToken
 * @returns {number | null}
 */
export function toGregorianYear(yearToken) {
    const raw = typeof yearToken === 'number' ? yearToken : parseInt(String(yearToken).trim(), 10);
    if (!Number.isFinite(raw)) return null;

    if (raw > 2500) return raw - 543;
    if (raw >= 1900) return raw;
    if (raw < 100) return raw >= 40 ? 2500 + raw - 543 : 2000 + raw;
    return null;
}

/**
 * (day, monthToken, yearToken) → "YYYY-MM-DD", or null when unparseable.
 * @param {string | number} day
 * @param {string | number} monthToken
 * @param {string | number} yearToken
 * @returns {string | null}
 */
export function toGregorianDate(day, monthToken, yearToken) {
    const d = typeof day === 'number' ? day : parseInt(String(day).trim(), 10);
    if (!Number.isFinite(d) || d < 1 || d > 31) return null;

    const month = monthFromToken(monthToken);
    if (!month) return null;

    const year = toGregorianYear(yearToken);
    if (!year || year < 2000 || year > 2100) return null;

    return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Accepts whatever the model produced for `date`; returns ISO date or null.
 * Handles ISO strings, Thai "30 ก.ค. 2569", "01/08/69" and unconverted BE years.
 * @param {unknown} input
 * @returns {string | null}
 */
export function normalizeDate(input) {
    if (typeof input !== 'string') return null;
    const raw = input.trim();
    if (!raw) return null;

    const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (iso) return toGregorianDate(iso[3], iso[2], iso[1]);

    const thai = raw.match(/^(\d{1,2})\s+([^\s]+)\s+(\d{2,4})$/);
    if (thai) return toGregorianDate(thai[1], thai[2], thai[3]);

    const numeric = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
    if (numeric) return toGregorianDate(numeric[1], numeric[2], numeric[3]);

    return null;
}

/**
 * @param {unknown} input
 * @returns {string | null}
 */
export function normalizeTime(input) {
    if (typeof input !== 'string') return null;
    const match = input.match(/(\d{1,2})[:.](\d{2})/);
    if (!match) return null;

    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    if (h > 23 || m > 59) return null;

    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Dates outside [today − 2y, today + 1d] are almost always misreads.
 * @param {string} iso
 * @param {Date} [now]
 * @returns {boolean}
 */
export function isPlausibleDate(iso, now = new Date()) {
    const parsed = new Date(`${iso}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return false;

    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const min = todayUtc - 2 * 365 * 24 * 3600 * 1000;
    const max = todayUtc + 24 * 3600 * 1000;
    return parsed.getTime() >= min && parsed.getTime() <= max;
}

/**
 * Parses a Thai bank slip "mini QR" payload (EMV-TLV).
 * Tag `00` holds a nested TLV: `00` = API id, `01` = sending bank code,
 * `02` = transaction reference.
 * @param {string} payload
 * @returns {{ bankCode: string, transRef: string } | null}
 */
export function parseSlipMiniQr(payload) {
    const root = parseTlv(payload);
    if (!root) return null;

    const inner = parseTlv(root['00'] ?? '');
    if (!inner) return null;

    const bankCode = inner['01'];
    const transRef = inner['02'];
    if (!bankCode || !transRef) return null;
    if (!/^\d{3}$/.test(bankCode)) return null;

    return { bankCode, transRef };
}

/**
 * @param {string} input
 * @returns {Record<string, string> | null}
 */
export function parseTlv(input) {
    if (!input || input.length < 4) return null;

    /** @type {Record<string, string>} */
    const out = {};
    let i = 0;

    while (i < input.length) {
        if (i + 4 > input.length) return null;

        const tag = input.slice(i, i + 2);
        const rawLength = input.slice(i + 2, i + 4);
        if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(rawLength)) return null;

        const length = parseInt(rawLength, 10);
        const start = i + 4;
        const end = start + length;
        if (end > input.length) return null;

        out[tag] = input.slice(start, end);
        i = end;
    }

    return Object.keys(out).length > 0 ? out : null;
}
