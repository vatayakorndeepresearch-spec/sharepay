import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { expenseCategories, incomeCategories } from '$lib/utils/expenseForm';

type CategorizeItem = {
    id: string | number;
    transactionType?: string;
    description?: string | null;
    notes?: string | null;
};

/** Slips from the same shop repeat constantly, so a per-instance memo saves most
 *  of the DeepSeek calls a bulk scan would otherwise make. */
const categoryCache = new Map<string, string>();
const CACHE_LIMIT = 500;

function cacheKey(item: CategorizeItem) {
    const type = item.transactionType === 'income' ? 'income' : 'expense';
    return `${type}|${(item.description || '').trim().toLowerCase()}|${(item.notes || '').trim().toLowerCase()}`;
}

function rememberCategory(key: string, category: string) {
    if (!category) return;
    if (categoryCache.size >= CACHE_LIMIT) {
        const oldest = categoryCache.keys().next().value;
        if (oldest !== undefined) categoryCache.delete(oldest);
    }
    categoryCache.set(key, category);
}

function categoriesFor(transactionType?: string): string[] {
    return transactionType === 'income' ? [...incomeCategories] : [...expenseCategories];
}

/** The model is told to answer with a bare category name, but it sometimes pads
 *  the reply — fall back to a containment match before giving up. */
function resolveCategory(answer: string, categories: string[]): string {
    const trimmed = (answer || '').trim();
    if (!trimmed) return '';
    if (categories.includes(trimmed)) return trimmed;
    return categories.find((c) => trimmed.includes(c) || c.includes(trimmed)) || '';
}

async function askDeepSeek(apiKey: string, systemPrompt: string, prompt: string, maxTokens: number) {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ],
            max_tokens: maxTokens,
            temperature: 0.1
        })
    });

    if (!response.ok) {
        console.error('DeepSeek API error:', response.status);
        return '';
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
}

async function categorizeOne(apiKey: string, item: CategorizeItem): Promise<string> {
    const categories = categoriesFor(item.transactionType);
    const prompt = `คุณเป็น AI ที่ช่วยจัดหมวดหมู่รายการค่าใช้จ่าย/รายรับ
จากข้อมูลต่อไปนี้ ให้เลือกหมวดหมู่ที่เหมาะสมที่สุด 1 หมวดหมู่เท่านั้น

ประเภทธุรกรรม: ${item.transactionType === 'income' ? 'รายรับ' : 'รายจ่าย'}
รายละเอียด: ${item.description || '-'}
หมายเหตุ: ${item.notes || '-'}

หมวดหมู่ที่เลือกได้:
${categories.join(', ')}

ตอบเฉพาะชื่อหมวดหมู่เท่านั้น ห้ามตอบอย่างอื่น ถ้าไม่แน่ใจให้ตอบว่า empty string`;

    const answer = await askDeepSeek(
        apiKey,
        'คุณเป็น AI จัดหมวดหมู่ค่าใช้จ่าย ตอบเฉพาะชื่อหมวดหมู่เท่านั้น',
        prompt,
        50
    );
    return resolveCategory(answer, categories);
}

/** One prompt for the whole batch — a bulk scan of N slips becomes a single
 *  DeepSeek round-trip instead of N. */
async function categorizeBatch(
    apiKey: string,
    items: CategorizeItem[]
): Promise<Array<{ id: string | number; category: string }>> {
    const expense = [...expenseCategories];
    const income = [...incomeCategories];

    const lines = items
        .map(
            (item, index) =>
                `${index + 1}. ประเภท: ${item.transactionType === 'income' ? 'รายรับ' : 'รายจ่าย'} | รายละเอียด: ${item.description || '-'} | หมายเหตุ: ${item.notes || '-'}`
        )
        .join('\n');

    const prompt = `คุณเป็น AI ที่ช่วยจัดหมวดหมู่รายการค่าใช้จ่าย/รายรับ
จัดหมวดหมู่ให้ทุกรายการด้านล่าง รายการละ 1 หมวดหมู่เท่านั้น

รายการ:
${lines}

หมวดหมู่รายจ่าย: ${expense.join(', ')}
หมวดหมู่รายรับ: ${income.join(', ')}

ตอบเป็น JSON array เท่านั้น รูปแบบ [{"n":1,"category":"..."}] เรียงตามลำดับรายการ
ถ้าไม่แน่ใจรายการไหน ให้ category เป็น "" ห้ามตอบข้อความอื่นนอกจาก JSON`;

    const answer = await askDeepSeek(
        apiKey,
        'คุณเป็น AI จัดหมวดหมู่ค่าใช้จ่าย ตอบเป็น JSON array เท่านั้น',
        prompt,
        Math.min(60 * items.length + 100, 2000)
    );

    let parsed: Array<{ n?: number; category?: string }> = [];
    try {
        const jsonText = answer.slice(answer.indexOf('['), answer.lastIndexOf(']') + 1);
        const candidate = JSON.parse(jsonText);
        if (Array.isArray(candidate)) parsed = candidate;
    } catch {
        console.error('DeepSeek batch categorize returned non-JSON');
    }

    const byIndex = new Map<number, string>();
    parsed.forEach((entry, position) => {
        const index = typeof entry?.n === 'number' ? entry.n - 1 : position;
        if (index >= 0 && index < items.length) byIndex.set(index, String(entry?.category ?? ''));
    });

    return items.map((item, index) => ({
        id: item.id,
        category: resolveCategory(byIndex.get(index) || '', categoriesFor(item.transactionType))
    }));
}

export const POST: RequestHandler = async ({ request }) => {
    const body = await request.json();
    const apiKey = env.DEEPSEEK_API_KEY;

    // Batch shape: { items: [{ id, transactionType, description, notes }] }
    if (Array.isArray(body?.items)) {
        const items = body.items as CategorizeItem[];
        if (!apiKey) {
            // Tell the client so it can stop showing an "AI is thinking" indicator.
            return json({ results: items.map((item) => ({ id: item.id, category: '' })), disabled: true });
        }

        const results = new Map<string | number, string>();
        const pending: CategorizeItem[] = [];

        for (const item of items) {
            if (!item.description && !item.notes) {
                results.set(item.id, '');
                continue;
            }
            const cached = categoryCache.get(cacheKey(item));
            if (cached !== undefined) {
                results.set(item.id, cached);
                continue;
            }
            pending.push(item);
        }

        if (pending.length > 0) {
            try {
                const answered = await categorizeBatch(apiKey, pending);
                for (const entry of answered) {
                    results.set(entry.id, entry.category);
                }
                for (const item of pending) {
                    rememberCategory(cacheKey(item), results.get(item.id) || '');
                }
            } catch (error) {
                console.error('DeepSeek batch categorize error:', error);
                for (const item of pending) {
                    if (!results.has(item.id)) results.set(item.id, '');
                }
            }
        }

        return json({ results: items.map((item) => ({ id: item.id, category: results.get(item.id) ?? '' })) });
    }

    // Single shape (the entry form) stays supported.
    if (!apiKey) {
        return json({ category: '', disabled: true });
    }

    const { notes, description, transactionType } = body;
    if (!notes && !description) {
        return json({ category: '' });
    }

    const item: CategorizeItem = { id: 0, transactionType, description, notes };
    const key = cacheKey(item);
    const cached = categoryCache.get(key);
    if (cached !== undefined) {
        return json({ category: cached });
    }

    try {
        const category = await categorizeOne(apiKey, item);
        rememberCategory(key, category);
        return json({ category });
    } catch (error) {
        console.error('DeepSeek categorize error:', error);
        return json({ category: '' });
    }
};
