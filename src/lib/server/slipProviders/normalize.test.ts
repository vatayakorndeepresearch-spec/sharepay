import { describe, expect, it } from 'vitest';
import { normalizeExtraction } from './normalize';
import { SlipExtractionSchema } from '$lib/types/slip';

const NOW = new Date('2026-08-02T00:00:00Z');

const modelOutput = {
    is_slip: true,
    bank: 'SCB',
    direction: 'transfer_out',
    amount: '200.00',
    fee: '0.00',
    date: '30 ก.ค. 2569',
    time: '21:03 น.',
    sender: { name: 'นาย วาทยากร จ.', account: 'xxx-x-x1234-x' },
    receiver: { name: 'นางสาว เกษร รามมะเริง', account: null },
    memo: 'ชำระค่าห้องที่ค้างอยู่',
    trans_ref: '202607304ZLhuJFqU8Cf6ChkK',
    confidence: 'high'
};

describe('normalizeExtraction', () => {
    it('normalizes a clean SCB slip', () => {
        const result = normalizeExtraction(modelOutput, null, NOW);

        expect(result.amount).toBe(200);
        expect(result.fee).toBe(0);
        expect(result.date).toBe('2026-07-30');
        expect(result.time).toBe('21:03');
        expect(result.bank).toBe('SCB');
        expect(result.memo).toBe('ชำระค่าห้องที่ค้างอยู่');
        expect(SlipExtractionSchema.safeParse(result).success).toBe(true);
    });

    it('lets the QR transaction reference win over the model', () => {
        const result = normalizeExtraction(
            { ...modelOutput, trans_ref: 'GARBLED-REF' },
            { bankCode: '014', transRef: '202607304ZLhuJFqU8Cf6ChkK' },
            NOW
        );

        expect(result.trans_ref).toBe('202607304ZLhuJFqU8Cf6ChkK');
    });

    it('fills the bank from the QR when the model says UNKNOWN, and forces is_slip', () => {
        const result = normalizeExtraction(
            { ...modelOutput, bank: 'UNKNOWN', is_slip: false },
            { bankCode: '004', transRef: 'ABC123' },
            NOW
        );

        expect(result.bank).toBe('KBANK');
        expect(result.is_slip).toBe(true);
    });

    it('drops implausible dates so the client can default to today', () => {
        expect(normalizeExtraction({ ...modelOutput, date: '2019-01-01' }, null, NOW).date).toBeNull();
        expect(normalizeExtraction({ ...modelOutput, date: '2030-01-01' }, null, NOW).date).toBeNull();
    });

    it('salvages malformed enums instead of failing the extraction', () => {
        const result = normalizeExtraction(
            { ...modelOutput, bank: 'SIAM_COMMERCIAL', direction: 'sent', confidence: 'very high' },
            null,
            NOW
        );

        expect(result.bank).toBe('UNKNOWN');
        expect(result.direction).toBe('unknown');
        expect(result.confidence).toBe('low');
        expect(result.amount).toBe(200);
    });

    it('nulls out placeholder strings and non-positive amounts', () => {
        const result = normalizeExtraction(
            { ...modelOutput, memo: 'null', amount: '0.00', sender: { name: '-', account: 'N/A' } },
            null,
            NOW
        );

        expect(result.memo).toBeNull();
        expect(result.amount).toBeNull();
        expect(result.sender).toEqual({ name: null, account: null });
    });

    it('handles a non-slip screenshot', () => {
        const result = normalizeExtraction(
            {
                is_slip: false,
                bank: 'UNKNOWN',
                direction: 'unknown',
                amount: 236.68,
                fee: null,
                date: null,
                time: null,
                sender: {},
                receiver: {},
                memo: null,
                trans_ref: null,
                confidence: 'low'
            },
            null,
            NOW
        );

        expect(result.is_slip).toBe(false);
        expect(result.amount).toBe(236.68);
        expect(SlipExtractionSchema.safeParse(result).success).toBe(true);
    });
});

describe('SlipExtractionSchema', () => {
    it('rejects structurally malformed model output', () => {
        expect(SlipExtractionSchema.safeParse({}).success).toBe(false);
        expect(SlipExtractionSchema.safeParse({ ...modelOutput, amount: '200.00' }).success).toBe(false);
        expect(
            SlipExtractionSchema.safeParse({ ...modelOutput, amount: 200, date: '30/07/2026' }).success
        ).toBe(false);
    });
});
