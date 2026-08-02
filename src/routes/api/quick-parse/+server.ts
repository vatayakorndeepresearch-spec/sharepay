import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import {
    expenseCategories,
    getTodayLocalDate,
    incomeCategories,
    normalizeCategoryInput,
    inferCategoryFromText,
    type TransactionType
} from '$lib/utils/expenseForm';

/**
 * Turns a free-text line like "ข้าวเที่ยง 450 เมื่อวาน" into expense-form fields.
 * Text-only, no PII beyond what the user typed — a good fit for DeepSeek.
 */
export const POST: RequestHandler = async ({ request, locals: { user } }) => {
    if (!user) {
        return json({ error: 'unauthorized' }, { status: 401 });
    }

    const apiKey = env.DEEPSEEK_API_KEY;
    if (!apiKey) {
        return json({ disabled: true });
    }

    let body: { text?: unknown };
    try {
        body = await request.json();
    } catch {
        return json({ error: 'invalid JSON body' }, { status: 400 });
    }

    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text || text.length > 300) {
        return json({ error: 'text must be 1-300 characters' }, { status: 400 });
    }

    const today = getTodayLocalDate();
    const prompt = `คุณแตกข้อความบันทึกรายจ่าย/รายรับภาษาไทยเป็น JSON
วันนี้คือ ${today} (ใช้คำนวณคำว่า เมื่อวาน/เมื่อวานซืน/วันจันทร์ที่แล้ว ฯลฯ)

ตอบเป็น JSON เท่านั้น คีย์:
- transaction_type: "expense" หรือ "income" (ดีฟอลต์ expense; เป็น income เมื่อได้รับเงิน เช่น เงินเดือนเข้า ขายของได้ มีคนคืนเงิน)
- amount: ตัวเลขบาท ไม่มีคอมมา (100k=100000, 1.5พัน=1500) หรือ null ถ้าไม่มี
- description: สิ่งที่จ่าย/ได้รับ สั้นกระชับ ไม่รวมจำนวนเงิน/วันที่ (เช่น "ข้าวเที่ยง")
- date: YYYY-MM-DD หรือ null ถ้าไม่ได้ระบุ (ห้ามเดา ถ้าไม่พูดถึงวันให้ null)
- category: เลือกจากรายการนี้เท่านั้น หรือ "" ถ้าไม่แน่ใจ
  รายจ่าย: ${expenseCategories.join(', ')}
  รายรับ: ${incomeCategories.join(', ')}
- notes: บริบทเพิ่มเติมที่เหลือ (เช่น "หาร 3 คน") หรือ ""

ข้อความ: """${text}"""`;

    try {
        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                temperature: 0,
                max_tokens: 300,
                response_format: { type: 'json_object' },
                messages: [{ role: 'user', content: prompt }]
            })
        });

        if (!response.ok) {
            console.error('[quick-parse] DeepSeek error:', response.status);
            return json({ error: 'parse failed' }, { status: 502 });
        }

        const data = await response.json();
        const raw = JSON.parse(data.choices?.[0]?.message?.content ?? '{}');

        const transactionType: TransactionType = raw.transaction_type === 'income' ? 'income' : 'expense';
        const amount =
            typeof raw.amount === 'number' && Number.isFinite(raw.amount) && raw.amount > 0
                ? Math.round(raw.amount * 100) / 100
                : null;
        const description = typeof raw.description === 'string' ? raw.description.trim().slice(0, 120) : '';
        const date =
            typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : null;
        const notes = typeof raw.notes === 'string' ? raw.notes.trim().slice(0, 300) : '';

        // Trust the category only if it maps into the real list; otherwise fall back
        // to the local keyword rules so the user never sees an invented category.
        const validCategories: readonly string[] =
            transactionType === 'income' ? incomeCategories : expenseCategories;
        let category = normalizeCategoryInput(typeof raw.category === 'string' ? raw.category : '');
        if (!validCategories.includes(category)) category = '';
        if (!category) category = inferCategoryFromText(transactionType, description, notes);

        return json({ transaction_type: transactionType, amount, description, date, category, notes });
    } catch (err) {
        console.error('[quick-parse] unexpected error:', (err as Error)?.message);
        return json({ error: 'parse failed' }, { status: 502 });
    }
};
