#!/usr/bin/env node
/**
 * Runs a slip-extraction pipeline over eval/slips/ and scores it against
 * eval/golden.jsonl.
 *
 *   node scripts/eval-ocr.mjs --pipeline typhoon [--limit 40] [--out eval/RESULTS.md]
 *
 * Pipelines: tesseract | typhoon | openrouter
 * Reuses the production prompts + normalizers from src/lib/shared/slipCore.js so
 * eval numbers reflect the shipped behaviour.
 */
import { readFile, readdir, writeFile, appendFile } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import {
    OCR_PROMPT,
    STRUCTURING_PROMPT,
    buildStructuringUserMessage,
    normalizeAmount,
    normalizeDate,
    parseSlipMiniQr
} from '../src/lib/shared/slipCore.js';

const ROOT = path.resolve(import.meta.dirname, '..');

function loadEnv() {
    const envPath = path.join(ROOT, '.env');
    if (!existsSync(envPath)) return;
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (match && !process.env[match[1]]) {
            process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
        }
    }
}

function arg(name, fallback) {
    const index = process.argv.indexOf(`--${name}`);
    return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const MIME_BY_EXT = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp'
};

async function postJson(url, apiKey, body) {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        throw new Error(`${url} → ${response.status} ${(await response.text()).slice(0, 200)}`);
    }
    return response.json();
}

function parseModelJson(content) {
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const body = (fenced ? fenced[1] : content).trim();
    try {
        return JSON.parse(body);
    } catch {
        const start = body.indexOf('{');
        const end = body.lastIndexOf('}');
        if (start !== -1 && end > start) return JSON.parse(body.slice(start, end + 1));
        throw new Error('model did not return JSON');
    }
}

// ---------------------------------------------------------------- pipelines

async function runTyphoon(buffer, mimeType) {
    const typhoonKey = process.env.TYPHOON_API_KEY;
    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    if (!typhoonKey) throw new Error('TYPHOON_API_KEY missing');
    if (!deepseekKey) throw new Error('DEEPSEEK_API_KEY missing');

    const ocr = await postJson('https://api.opentyphoon.ai/v1/chat/completions', typhoonKey, {
        model: process.env.TYPHOON_MODEL || 'typhoon-ocr-preview',
        temperature: 0,
        max_tokens: 1600,
        messages: [
            {
                role: 'user',
                content: [
                    { type: 'text', text: OCR_PROMPT },
                    {
                        type: 'image_url',
                        image_url: { url: `data:${mimeType};base64,${buffer.toString('base64')}` }
                    }
                ]
            }
        ]
    });

    const ocrText = ocr.choices?.[0]?.message?.content ?? '';
    const structured = await postJson('https://api.deepseek.com/chat/completions', deepseekKey, {
        model: 'deepseek-chat',
        temperature: 0,
        max_tokens: 800,
        response_format: { type: 'json_object' },
        messages: [
            { role: 'system', content: STRUCTURING_PROMPT },
            { role: 'user', content: buildStructuringUserMessage(ocrText) }
        ]
    });

    return parseModelJson(structured.choices?.[0]?.message?.content ?? '');
}

async function runOpenRouter(buffer, mimeType) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY missing');

    const payload = await postJson('https://openrouter.ai/api/v1/chat/completions', apiKey, {
        model: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash',
        temperature: 0,
        max_tokens: 900,
        response_format: { type: 'json_object' },
        messages: [
            { role: 'system', content: STRUCTURING_PROMPT },
            {
                role: 'user',
                content: [
                    { type: 'text', text: buildStructuringUserMessage('(read the attached slip image)') },
                    {
                        type: 'image_url',
                        image_url: { url: `data:${mimeType};base64,${buffer.toString('base64')}` }
                    }
                ]
            }
        ]
    });

    return parseModelJson(payload.choices?.[0]?.message?.content ?? '');
}

let tesseractWorker = null;
async function runTesseract(buffer) {
    if (!tesseractWorker) {
        const { createWorker } = await import('tesseract.js');
        tesseractWorker = await createWorker('tha+eng');
    }

    const {
        data: { text }
    } = await tesseractWorker.recognize(buffer);
    const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);

    // Mirrors the legacy regex parser closely enough to score the baseline.
    let amount = null;
    for (const line of lines) {
        if (/ค่าธรรมเนียม|fee/i.test(line)) continue;
        const labelled = line.match(/(?:จำนวน|จํานวน|amount)\s*[:.]?\s*([\d,]+\.?\d*)/i);
        if (labelled) {
            amount = normalizeAmount(labelled[1]);
            break;
        }
    }
    if (amount === null) {
        for (const line of lines) {
            if (/ค่าธรรมเนียม|fee/i.test(line)) continue;
            const bare = line.match(/([\d,]+\.\d{2})\s*(?:บาท|THB)/i);
            if (bare) {
                amount = normalizeAmount(bare[1]);
                break;
            }
        }
    }

    let date = null;
    for (const line of lines) {
        const match = line.match(/(\d{1,2})[\s./-]+([ก-๙a-zA-Z.]+)[\s./-]+(\d{2,4})/);
        if (match) {
            date = normalizeDate(`${match[1]} ${match[2]} ${match[3]}`);
            if (date) break;
        }
    }

    let memo = null;
    for (let i = 0; i < lines.length; i++) {
        const label = lines[i].match(/(?:บันทึกช่วยจำ|บันทึกช่วยจํา|note|memo)/i);
        if (!label) continue;
        memo = lines[i].slice(label.index + label[0].length).replace(/^[:.\s]+/, '').trim() || lines[i + 1] || null;
        break;
    }

    return { is_slip: amount !== null, amount, date, memo, trans_ref: null, confidence: 'low' };
}

const PIPELINES = { tesseract: runTesseract, typhoon: runTyphoon, openrouter: runOpenRouter };

// ------------------------------------------------------------------ scoring

function normalizeText(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const curr = [i];
        for (let j = 1; j <= b.length; j++) {
            curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        prev = curr;
    }
    return prev[b.length];
}

function similarity(a, b) {
    const x = normalizeText(a);
    const y = normalizeText(b);
    if (!x && !y) return 1;
    if (!x || !y) return 0;
    return 1 - levenshtein(x, y) / Math.max(x.length, y.length);
}

function pct(hits, total) {
    return total === 0 ? '—' : `${((hits / total) * 100).toFixed(1)}%`;
}

// --------------------------------------------------------------------- main

async function main() {
    loadEnv();

    const pipelineName = arg('pipeline', 'tesseract');
    const pipeline = PIPELINES[pipelineName];
    if (!pipeline) {
        console.error(`unknown pipeline "${pipelineName}" (tesseract | typhoon | openrouter)`);
        process.exit(1);
    }

    const slipsDir = path.resolve(ROOT, arg('slips', 'eval/slips'));
    const goldenPath = path.resolve(ROOT, arg('golden', 'eval/golden.jsonl'));
    const limit = parseInt(arg('limit', '1000'), 10);

    if (!existsSync(goldenPath)) {
        console.error(`missing golden set: ${path.relative(ROOT, goldenPath)}`);
        process.exit(1);
    }

    const golden = (await readFile(goldenPath, 'utf8'))
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('//'))
        .map((line) => JSON.parse(line));

    const available = new Set(await readdir(slipsDir).catch(() => []));
    const rows = golden.filter((row) => available.has(row.file)).slice(0, limit);
    const missing = golden.length - rows.length;

    const stats = {
        amount: { hits: 0, total: 0 },
        date: { hits: 0, total: 0 },
        memo: { hits: 0, total: 0 },
        trans_ref: { hits: 0, total: 0 },
        non_slip: { hits: 0, total: 0 }
    };
    const failures = [];
    let errors = 0;

    for (const row of rows) {
        const filePath = path.join(slipsDir, row.file);
        const buffer = await readFile(filePath);
        const mimeType = MIME_BY_EXT[path.extname(row.file).toLowerCase()] || 'image/jpeg';

        let result;
        try {
            result = await pipeline(buffer, mimeType);
        } catch (error) {
            errors++;
            failures.push(`${row.file}: ${error.message}`);
            result = {};
        }

        if (row.is_slip === false) {
            stats.non_slip.total++;
            if (result.is_slip === false) stats.non_slip.hits++;
        }

        if (row.amount != null) {
            stats.amount.total++;
            const got = normalizeAmount(result.amount);
            if (got !== null && Math.abs(got - row.amount) < 0.005) stats.amount.hits++;
            else failures.push(`${row.file}: amount expected ${row.amount} got ${got}`);
        }

        if (row.date) {
            stats.date.total++;
            const got = normalizeDate(result.date);
            if (got === row.date) stats.date.hits++;
            else failures.push(`${row.file}: date expected ${row.date} got ${got}`);
        }

        if (row.memo) {
            stats.memo.total++;
            if (similarity(result.memo, row.memo) >= 0.85) stats.memo.hits++;
            else failures.push(`${row.file}: memo mismatch (${similarity(result.memo, row.memo).toFixed(2)})`);
        }

        if (row.trans_ref) {
            stats.trans_ref.total++;
            if (normalizeText(result.trans_ref) === normalizeText(row.trans_ref)) stats.trans_ref.hits++;
        }

        process.stdout.write('.');
    }
    process.stdout.write('\n');

    const table = [
        `### ${pipelineName} — ${rows.length} slips${missing ? ` (${missing} golden rows not downloaded)` : ''}`,
        '',
        '| metric | score | hits/total |',
        '|---|---|---|',
        `| amount_acc | ${pct(stats.amount.hits, stats.amount.total)} | ${stats.amount.hits}/${stats.amount.total} |`,
        `| date_acc | ${pct(stats.date.hits, stats.date.total)} | ${stats.date.hits}/${stats.date.total} |`,
        `| memo_acc | ${pct(stats.memo.hits, stats.memo.total)} | ${stats.memo.hits}/${stats.memo.total} |`,
        `| trans_ref_acc | ${pct(stats.trans_ref.hits, stats.trans_ref.total)} | ${stats.trans_ref.hits}/${stats.trans_ref.total} |`,
        `| non_slip_rejection | ${pct(stats.non_slip.hits, stats.non_slip.total)} | ${stats.non_slip.hits}/${stats.non_slip.total} |`,
        `| pipeline_errors | ${errors} | |`,
        ''
    ].join('\n');

    console.log(table);
    if (failures.length) {
        console.log('First failures:');
        for (const failure of failures.slice(0, 15)) console.log(`  - ${failure}`);
    }

    const outPath = arg('out', '');
    if (outPath) {
        await appendFile(path.resolve(ROOT, outPath), `\n${table}\n`);
        console.log(`appended → ${outPath}`);
    }

    if (tesseractWorker) await tesseractWorker.terminate();
}

// Exposed for the QR-only scoring path used when grading trans_ref from payload fixtures.
export { parseSlipMiniQr };

main();
