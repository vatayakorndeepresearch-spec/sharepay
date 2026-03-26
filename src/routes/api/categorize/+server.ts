import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { expenseCategories, incomeCategories } from '$lib/utils/expenseForm';

export const POST: RequestHandler = async ({ request }) => {
    const apiKey = env.DEEPSEEK_API_KEY;
    if (!apiKey) {
        return json({ category: '' }, { status: 200 });
    }

    const { notes, description, transactionType } = await request.json();

    if (!notes && !description) {
        return json({ category: '' });
    }

    const categories: string[] = transactionType === 'income'
        ? [...incomeCategories]
        : [...expenseCategories];

    const prompt = `คุณเป็น AI ที่ช่วยจัดหมวดหมู่รายการค่าใช้จ่าย/รายรับ
จากข้อมูลต่อไปนี้ ให้เลือกหมวดหมู่ที่เหมาะสมที่สุด 1 หมวดหมู่เท่านั้น

ประเภทธุรกรรม: ${transactionType === 'income' ? 'รายรับ' : 'รายจ่าย'}
รายละเอียด: ${description || '-'}
หมายเหตุ: ${notes || '-'}

หมวดหมู่ที่เลือกได้:
${categories.join(', ')}

ตอบเฉพาะชื่อหมวดหมู่เท่านั้น ห้ามตอบอย่างอื่น ถ้าไม่แน่ใจให้ตอบว่า empty string`;

    try {
        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: 'คุณเป็น AI จัดหมวดหมู่ค่าใช้จ่าย ตอบเฉพาะชื่อหมวดหมู่เท่านั้น' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 50,
                temperature: 0.1
            })
        });

        if (!response.ok) {
            console.error('DeepSeek API error:', response.status);
            return json({ category: '' });
        }

        const data = await response.json();
        const aiCategory = data.choices?.[0]?.message?.content?.trim() || '';

        // Validate that AI returned a valid category
        if (categories.includes(aiCategory)) {
            return json({ category: aiCategory });
        }

        // Try partial match
        const matched = categories.find(c => aiCategory.includes(c) || c.includes(aiCategory));
        return json({ category: matched || '' });
    } catch (error) {
        console.error('DeepSeek categorize error:', error);
        return json({ category: '' });
    }
};
