#!/usr/bin/env node
/**
 * Decodes the mini-QR of every slip in eval/slips/ and prints
 * `<file> <bankCode> <transRef>` (or `<file> -`), plus a coverage summary.
 *
 *   node scripts/qr-scan.mjs [--slips eval/slips] [--limit 100] [--json out.json]
 *
 * Mirrors the client strategy in src/lib/utils/slipQr.ts: full image first, then
 * 2x-upscaled bottom crops.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Jimp } from 'jimp';
import jsQR from 'jsqr';
import { parseSlipMiniQr } from '../src/lib/shared/slipCore.js';

const ROOT = path.resolve(import.meta.dirname, '..');

function arg(name, fallback) {
    const index = process.argv.indexOf(`--${name}`);
    return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function scan(image) {
    const { width, height, data } = image.bitmap;
    return jsQR(new Uint8ClampedArray(data), width, height, { inversionAttempts: 'attemptBoth' });
}

async function decode(buffer) {
    const original = await Jimp.read(buffer);

    const longEdge = Math.max(original.bitmap.width, original.bitmap.height);
    const base = longEdge > 1600 ? original.clone().scale(1600 / longEdge) : original;

    const direct = scan(base);
    if (direct?.data) return direct.data;

    const w = base.bitmap.width;
    const h = base.bitmap.height;
    const crops = [
        [Math.floor(w / 2), Math.floor(h / 2), Math.floor(w / 2), Math.floor(h / 2)],
        [0, Math.floor(h / 2), Math.floor(w / 2), Math.floor(h / 2)],
        [Math.floor(w / 4), Math.floor(h / 2), Math.floor(w / 2), Math.floor(h / 2)],
        [0, Math.floor(h * 0.6), w, Math.floor(h * 0.4)]
    ];

    for (const [x, y, cw, ch] of crops) {
        if (cw < 20 || ch < 20) continue;
        const crop = base.clone().crop({ x, y, w: cw, h: ch }).scale(2);
        const found = scan(crop);
        if (found?.data) return found.data;
    }

    return null;
}

async function main() {
    const slipsDir = path.resolve(ROOT, arg('slips', 'eval/slips'));
    const limit = parseInt(arg('limit', '1000'), 10);
    const files = (await readdir(slipsDir)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort().slice(0, limit);

    const results = [];
    let decoded = 0;
    let parsed = 0;

    for (const file of files) {
        let payload = null;
        try {
            payload = await decode(await readFile(path.join(slipsDir, file)));
        } catch (error) {
            console.warn(`${file}: ${error.message}`);
        }

        const hint = payload ? parseSlipMiniQr(payload) : null;
        if (payload) decoded++;
        if (hint) parsed++;

        results.push({ file, payload, hint });
        console.log(hint ? `${file} ${hint.bankCode} ${hint.transRef}` : `${file} -`);
    }

    console.log(
        `\nQR decoded: ${decoded}/${files.length} (${((decoded / files.length) * 100).toFixed(1)}%), ` +
            `mini-QR parsed: ${parsed}/${files.length} (${((parsed / files.length) * 100).toFixed(1)}%)`
    );

    const jsonOut = arg('json', '');
    if (jsonOut) {
        await writeFile(path.resolve(ROOT, jsonOut), JSON.stringify(results, null, 2));
        console.log(`wrote ${jsonOut}`);
    }
}

main();
