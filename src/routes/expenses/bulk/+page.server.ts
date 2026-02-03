import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
    const { data: projects } = await supabase.from('projects').select('*').eq('is_active', true).order('name');
    const { data: profiles } = await supabase.from('profiles').select('*').order('display_name');

    return {
        projects: projects || [],
        profiles: profiles || []
    };
};

export const actions: Actions = {
    batchSave: async ({ request, locals: { supabase } }) => {
        const formData = await request.formData();
        const itemCount = parseInt(formData.get('item_count') as string || '0');

        console.log('=== Bulk Save Debug ===');
        console.log('Item count:', itemCount);

        // Log all form data keys
        for (const [key, value] of formData.entries()) {
            if (key.includes('file')) {
                console.log(`${key}: [File object]`);
            } else {
                console.log(`${key}:`, value);
            }
        }
        console.log('=== End Debug ===');

        const errors = [];
        const successIds = [];

        for (let i = 0; i < itemCount; i++) {
            try {
                const projectId = formData.get(`item_${i}_project_id`) as string;
                const transactionType = (formData.get(`item_${i}_transaction_type`) as string) || 'expense';
                const paidBy = formData.get(`item_${i}_paid_by`) as string;
                const amount = parseFloat(formData.get(`item_${i}_amount`) as string);
                const paidAt = formData.get(`item_${i}_date`) as string;
                const description = formData.get(`item_${i}_description`) as string;
                const category = (formData.get(`item_${i}_category`) as string) || 'Others';
                const notes = formData.get(`item_${i}_notes`) as string || '';
                const file = formData.get(`item_${i}_file`) as File;

                console.log(`Processing item ${i}:`, { projectId, transactionType, paidBy, amount, paidAt, description, category });

                let uploadedUrl: string | null = null;

                // Handle File Upload
                if (file && file.size > 0) {
                    if (file.size > 5 * 1024 * 1024) {
                        errors.push(`รายการที่ ${i + 1}: รูปภาพต้องมีขนาดไม่เกิน 5MB`);
                        continue;
                    }

                    const fileExt = file.name.split('.').pop();
                    const fileName = `uploads/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

                    const { error: uploadError } = await supabase.storage
                        .from('expense_proofs')
                        .upload(fileName, file);

                    if (uploadError) {
                        console.error(`Upload error for item ${i}:`, uploadError);
                        errors.push(`รายการที่ ${i + 1}: อัพโหลดรูปไม่สำเร็จ`);
                        continue;
                    }

                    const { data: { publicUrl } } = supabase.storage
                        .from('expense_proofs')
                        .getPublicUrl(fileName);

                    uploadedUrl = publicUrl;
                }

                if (isNaN(amount) || amount <= 0) {
                    errors.push(`รายการที่ ${i + 1}: จำนวนเงินไม่ถูกต้อง`);
                    continue;
                }

                if (!projectId) {
                    errors.push(`รายการที่ ${i + 1}: กรุณาเลือกโปรเจค`);
                    continue;
                }

                // Insert Expense
                const { data: expense, error: insertError } = await supabase.from('expenses').insert({
                    project_id: projectId,
                    transaction_type: transactionType,
                    paid_by: paidBy,
                    amount,
                    paid_at: paidAt || new Date().toISOString().split('T')[0],
                    description: description || 'บันทึกแบบกลุ่ม',
                    category: category || 'อื่นๆ',
                    notes,
                    is_reimbursed: transactionType === 'income' ? true : false,
                    proof_image_url: uploadedUrl
                }).select().single();

                if (insertError) {
                    console.error(`Insert Error for item ${i}:`, insertError);
                    errors.push(`รายการที่ ${i + 1}: บันทึกข้อมูลไม่สำเร็จ (${insertError.message})`);
                    continue;
                }

                if (uploadedUrl && expense) {
                    await supabase.from('expense_attachments').insert({
                        expense_id: expense.id,
                        file_url: uploadedUrl,
                        file_type: 'image'
                    });
                }

                successIds.push(expense.id);
            } catch (err) {
                console.error(`Error processing item ${i}:`, err);
                errors.push(`รายการที่ ${i + 1}: เกิดข้อผิดพลาดที่ไม่คาดคิด`);
            }
        }

        if (errors.length > 0) {
            return fail(400, {
                error: `บันทึกสำเร็จ ${successIds.length} รายการ, ผิดพลาด ${errors.length} รายการ: ${errors.join(', ')}`,
                successCount: successIds.length,
                errorCount: errors.length
            });
        }

        throw redirect(303, '/expenses');
    }
};
