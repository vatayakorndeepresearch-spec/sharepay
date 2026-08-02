#!/usr/bin/env node
/**
 * Downloads the most recent slip images from the public `expense_proofs` bucket
 * into eval/slips/ (gitignored) so the eval harness has a local corpus.
 *
 *   node scripts/fetch-slips.mjs [--limit 100] [--out eval/slips]
 */
import { mkdir, writeFile, readdir } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

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

async function main() {
    loadEnv();
    const url = process.env.PUBLIC_SUPABASE_URL;
    const key = process.env.PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
        console.error('PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY are required (.env)');
        process.exit(1);
    }

    const limit = parseInt(arg('limit', '100'), 10);
    const outDir = path.resolve(ROOT, arg('out', 'eval/slips'));
    await mkdir(outDir, { recursive: true });

    const listResponse = await fetch(`${url}/storage/v1/object/list/expense_proofs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
        body: JSON.stringify({
            prefix: 'uploads',
            limit,
            offset: 0,
            sortBy: { column: 'created_at', order: 'desc' }
        })
    });

    if (!listResponse.ok) {
        console.error(`list failed: ${listResponse.status} ${await listResponse.text()}`);
        process.exit(1);
    }

    const objects = (await listResponse.json()).filter((item) => item.name && item.id);
    const existing = new Set(await readdir(outDir).catch(() => []));

    let downloaded = 0;
    for (const object of objects) {
        if (existing.has(object.name)) continue;

        const fileResponse = await fetch(`${url}/storage/v1/object/public/expense_proofs/uploads/${object.name}`, {
            headers: { apikey: key }
        });
        if (!fileResponse.ok) {
            console.warn(`skip ${object.name}: ${fileResponse.status}`);
            continue;
        }

        await writeFile(path.join(outDir, object.name), Buffer.from(await fileResponse.arrayBuffer()));
        downloaded++;
    }

    console.log(`listed ${objects.length} objects, downloaded ${downloaded} new → ${path.relative(ROOT, outDir)}`);
}

main();
