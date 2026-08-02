import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_BYTES, decodedByteLength, parseSlipRequest } from './slipRequest';

const tinyJpeg = 'a'.repeat(64);

describe('parseSlipRequest', () => {
    it('accepts a valid payload and strips the data URI prefix', () => {
        const result = parseSlipRequest({
            imageBase64: `data:image/jpeg;base64,${tinyJpeg}`,
            mimeType: 'image/jpeg'
        });

        expect(result).toEqual({ ok: true, imageBase64: tinyJpeg, mimeType: 'image/jpeg', hint: null });
    });

    it('keeps a well-formed QR hint and drops a malformed one', () => {
        const withHint = parseSlipRequest({
            imageBase64: tinyJpeg,
            mimeType: 'image/png',
            qrPayload: { bankCode: '014', transRef: 'ABC123' }
        });
        expect(withHint).toMatchObject({ ok: true, hint: { bankCode: '014', transRef: 'ABC123' } });

        const badHint = parseSlipRequest({
            imageBase64: tinyJpeg,
            mimeType: 'image/png',
            qrPayload: { bankCode: 14 }
        });
        expect(badHint).toMatchObject({ ok: true, hint: null });
    });

    it('rejects bad input with 400', () => {
        expect(parseSlipRequest(null)).toEqual({ ok: false, status: 400, error: 'invalid JSON body' });
        expect(parseSlipRequest({ mimeType: 'image/jpeg' })).toMatchObject({ status: 400 });
        expect(parseSlipRequest({ imageBase64: tinyJpeg, mimeType: 'application/pdf' })).toMatchObject({
            status: 400,
            error: 'unsupported mimeType'
        });
        expect(parseSlipRequest({ imageBase64: tinyJpeg, mimeType: 'image/gif' })).toMatchObject({
            status: 400
        });
    });

    it('rejects images over 4MB', () => {
        // 5 MB of decoded bytes ⇒ ~6.67 MB of base64
        const big = 'a'.repeat(Math.ceil((5 * 1024 * 1024 * 4) / 3));
        expect(decodedByteLength(big)).toBeGreaterThan(MAX_IMAGE_BYTES);
        expect(parseSlipRequest({ imageBase64: big, mimeType: 'image/jpeg' })).toEqual({
            ok: false,
            status: 400,
            error: 'image exceeds 4MB'
        });
    });
});

describe('decodedByteLength', () => {
    it('accounts for base64 padding', () => {
        expect(decodedByteLength('AAAA')).toBe(3);
        expect(decodedByteLength('AAA=')).toBe(2);
        expect(decodedByteLength('AA==')).toBe(1);
        expect(decodedByteLength('')).toBe(0);
    });
});
