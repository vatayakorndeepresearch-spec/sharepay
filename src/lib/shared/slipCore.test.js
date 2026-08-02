import { describe, expect, it } from 'vitest';
import {
    isPlausibleDate,
    normalizeAmount,
    normalizeDate,
    normalizeTime,
    parseSlipMiniQr,
    toGregorianDate,
    toGregorianYear
} from './slipCore.js';

describe('parseSlipMiniQr', () => {
    // Real-world shaped payloads: 00 = nested TLV (00 API id, 01 bank, 02 ref),
    // 51 = merchant/extra block that must be skipped without breaking the parse.
    const scb = '004400060000010103014022320260730xtT4pu9cCf6ChkK51040014';
    const kbank = '004100060000010103004022020260801KB009988776651040014';
    const kkp = '004100060000010103069022020260715KKP12345678951040014';

    it('extracts bank code and transaction reference (SCB)', () => {
        expect(parseSlipMiniQr(scb)).toEqual({
            bankCode: '014',
            transRef: '20260730xtT4pu9cCf6ChkK'
        });
    });

    it('extracts bank code and transaction reference (KBANK)', () => {
        expect(parseSlipMiniQr(kbank)).toEqual({ bankCode: '004', transRef: '20260801KB0099887766' });
    });

    it('extracts bank code and transaction reference (KKP)', () => {
        expect(parseSlipMiniQr(kkp)).toEqual({ bankCode: '069', transRef: '20260715KKP123456789' });
    });

    // Payloads captured from production slips via `node scripts/qr-scan.mjs`, with the
    // reference tail masked (same length, so the TLV structure stays authentic).
    it('parses real production payload shapes (trailing country/CRC tags included)', () => {
        expect(parseSlipMiniQr('003900060000010103004021801613218XXXXXXXXXX5102TH91040F79')).toEqual({
            bankCode: '004',
            transRef: '01613218XXXXXXXXXX'
        });
        expect(
            parseSlipMiniQr('004600060000010103014022520260526XXXXXXXXXXXXXXXXX5102TH9104208A')
        ).toEqual({ bankCode: '014', transRef: '20260526XXXXXXXXXXXXXXXXX' });
        expect(parseSlipMiniQr('003300060000010103069021261531343XXXX5102TH9104835A')).toEqual({
            bankCode: '069',
            transRef: '61531343XXXX'
        });
        expect(parseSlipMiniQr('0042000600000101030060221C2026060XXXXXXXXXXXXX5102TH9104DC5B')).toEqual({
            bankCode: '006',
            transRef: 'C2026060XXXXXXXXXXXXX'
        });
    });

    it('rejects malformed payloads', () => {
        expect(parseSlipMiniQr('')).toBeNull();
        expect(parseSlipMiniQr('not-a-tlv-payload')).toBeNull();
        expect(parseSlipMiniQr('009900060000010103014')).toBeNull(); // length overruns the buffer
        expect(parseSlipMiniQr('00100006000001')).toBeNull(); // no bank code / ref sub-tags
        expect(parseSlipMiniQr('002200060000010103ABC0201X')).toBeNull(); // non-numeric bank code
        expect(parseSlipMiniQr('51040014')).toBeNull(); // tag 00 missing
    });
});

describe('normalizeAmount', () => {
    it('parses commas, currency words and numbers', () => {
        expect(normalizeAmount('11,000.00 บาท')).toBe(11000);
        expect(normalizeAmount('236.68')).toBe(236.68);
        expect(normalizeAmount('1,234.5 THB')).toBe(1234.5);
        expect(normalizeAmount(500)).toBe(500);
    });

    it('returns null for junk', () => {
        expect(normalizeAmount('บาท')).toBeNull();
        expect(normalizeAmount(null)).toBeNull();
        expect(normalizeAmount(undefined)).toBeNull();
    });
});

describe('toGregorianYear', () => {
    it('converts Buddhist Era and short years', () => {
        expect(toGregorianYear(2569)).toBe(2026);
        expect(toGregorianYear('2569')).toBe(2026);
        expect(toGregorianYear(69)).toBe(2026);
        expect(toGregorianYear('69')).toBe(2026);
        expect(toGregorianYear(26)).toBe(2026);
        expect(toGregorianYear(2026)).toBe(2026);
    });

    it('returns null for unusable tokens', () => {
        expect(toGregorianYear('abc')).toBeNull();
        expect(toGregorianYear(150)).toBeNull();
    });
});

describe('toGregorianDate', () => {
    it('handles Thai month abbreviations, with and without dots', () => {
        expect(toGregorianDate(30, 'ก.ค.', 2569)).toBe('2026-07-30');
        expect(toGregorianDate('1', 'ส.ค', '69')).toBe('2026-08-01');
        expect(toGregorianDate('1', 'สค', '69')).toBe('2026-08-01');
    });

    it('handles full Thai month names and English months', () => {
        expect(toGregorianDate(5, 'ธันวาคม', 2568)).toBe('2025-12-05');
        expect(toGregorianDate(5, 'มกราคม', 2569)).toBe('2026-01-05');
        expect(toGregorianDate(9, 'aug', 2026)).toBe('2026-08-09');
        expect(toGregorianDate(9, 'August', 2026)).toBe('2026-08-09');
    });

    it('rejects impossible components', () => {
        expect(toGregorianDate(0, 'ก.ค.', 2569)).toBeNull();
        expect(toGregorianDate(32, 'ก.ค.', 2569)).toBeNull();
        expect(toGregorianDate(10, '5m', 2569)).toBeNull(); // garbled-OCR heuristics are gone
        expect(toGregorianDate(10, 13, 2569)).toBeNull();
    });
});

describe('normalizeDate', () => {
    it('passes through ISO Gregorian dates', () => {
        expect(normalizeDate('2026-07-30')).toBe('2026-07-30');
    });

    it('converts BE years that the model left unconverted', () => {
        expect(normalizeDate('2569-07-30')).toBe('2026-07-30');
        expect(normalizeDate('30 ก.ค. 2569')).toBe('2026-07-30');
        expect(normalizeDate('01/08/69')).toBe('2026-08-01');
    });

    it('returns null for unparseable input', () => {
        expect(normalizeDate('เมื่อวาน')).toBeNull();
        expect(normalizeDate(null)).toBeNull();
        expect(normalizeDate(42)).toBeNull();
    });
});

describe('normalizeTime', () => {
    it('normalizes to HH:MM', () => {
        expect(normalizeTime('21:03')).toBe('21:03');
        expect(normalizeTime('9:05 น.')).toBe('09:05');
        expect(normalizeTime('21.03 น.')).toBe('21:03');
    });

    it('rejects invalid clock values', () => {
        expect(normalizeTime('25:00')).toBeNull();
        expect(normalizeTime('12:99')).toBeNull();
        expect(normalizeTime('later')).toBeNull();
    });
});

describe('isPlausibleDate', () => {
    const now = new Date('2026-08-02T00:00:00Z');

    it('accepts recent dates', () => {
        expect(isPlausibleDate('2026-07-30', now)).toBe(true);
        expect(isPlausibleDate('2026-08-03', now)).toBe(true);
    });

    it('rejects far past and future', () => {
        expect(isPlausibleDate('2020-01-01', now)).toBe(false);
        expect(isPlausibleDate('2027-01-01', now)).toBe(false);
    });
});
