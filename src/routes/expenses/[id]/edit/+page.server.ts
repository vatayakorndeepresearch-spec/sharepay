import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { resolveCategory } from '$lib/utils/expenseForm';

export const load: PageServerLoad = async ({ params, locals: { supabase }, parent }) => {
    const { id } = params;
    const parentPromise = parent();
    const expensePromise = supabase
        .from('expenses')
        .select('*')
        .eq('id', id)
        .single();
    const projectsPromise = supabase
        .from('projects')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
    const profilesPromise = supabase
        .from('profiles')
        .select('id, display_name')
        .order('display_name');
    const attachmentsPromise = supabase
        .from('expense_attachments')
        .select('*')
        .eq('expense_id', id);

    const [
        { currentProfileId, currentUser },
        { data: expense },
        { data: projects },
        { data: profiles },
        { data: attachments }
    ] = await Promise.all([
        parentPromise,
        expensePromise,
        projectsPromise,
        profilesPromise,
        attachmentsPromise
    ]);

    if (!expense) {
        throw redirect(303, '/expenses');
    }

    return {
        expense: { ...expense, attachments: attachments || [] },
        projects: projects || [],
        profiles: profiles || [],
        currentProfileId,
        currentUser
    };
};

export const actions: Actions = {
    update: async ({ request, params, locals: { supabase } }) => {
        const { id } = params;
        const formData = await request.formData();

        const projectId = formData.get('project_id') as string;
        const transactionType = (formData.get('transaction_type') as string) || 'expense';
        const paidBy = formData.get('paid_by') as string;
        const amount = parseFloat(formData.get('amount') as string);
        const paidAt = formData.get('paid_at') as string;
        const description = formData.get('description') as string;
        const notes = formData.get('notes') as string;
        const category = resolveCategory({
            transactionType: transactionType === 'income' ? 'income' : 'expense',
            category: formData.get('category') as string,
            description,
            notes
        });
        const files = formData.getAll('proof_images') as File[];
        let uploadedUrls: string[] = [];

        if (!projectId || !paidBy || isNaN(amount) || amount <= 0 || !paidAt || !description) {
            return fail(400, { error: 'กรุณากรอกข้อมูลให้ครบถ้วน และจำนวนเงินต้องมากกว่า 0' });
        }

        // Settlement state is owned by the reimburse/unreimburse actions on the detail page.
        // Only touch it here when the transaction type itself changes, otherwise editing a
        // cleared expense would silently reset it back to unpaid.
        const { data: currentExpense } = await supabase
            .from('expenses')
            .select('proof_image_url, transaction_type, is_reimbursed')
            .eq('id', id)
            .single();

        const updates: Record<string, unknown> = {
            project_id: projectId,
            transaction_type: transactionType,
            paid_by: paidBy,
            amount,
            paid_at: paidAt,
            description,
            category,
            notes
        };

        if (transactionType === 'income' && !currentExpense?.is_reimbursed) {
            updates.is_reimbursed = true;
            updates.reimbursed_at = new Date().toISOString();
            updates.reimbursed_by = paidBy;
        } else if (
            transactionType === 'expense' &&
            currentExpense?.transaction_type === 'income'
        ) {
            updates.is_reimbursed = false;
            updates.reimbursed_at = null;
            updates.reimbursed_by = null;
        }

        // Handle Multiple File Uploads
        if (files && files.length > 0) {
            for (const file of files) {
                if (file.size > 0) {
                    if (file.size > 5 * 1024 * 1024) {
                        return fail(400, { error: 'รูปภาพต้องมีขนาดไม่เกิน 5MB' });
                    }

                    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic'];
                    const allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'];
                    const fileExt = file.name.split('.').pop()?.toLowerCase();
                    if (!fileExt || !allowedExts.includes(fileExt) || !allowedTypes.includes(file.type)) {
                        return fail(400, { error: 'อนุญาตเฉพาะไฟล์รูปภาพ (JPG, PNG, GIF, WebP, HEIC)' });
                    }

                    const fileName = `uploads/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

                    const { error: uploadError } = await supabase.storage
                        .from('expense_proofs')
                        .upload(fileName, file);

                    if (uploadError) {
                        console.error('Upload error:', uploadError);
                        continue;
                    }

                    const { data: { publicUrl } } = supabase.storage
                        .from('expense_proofs')
                        .getPublicUrl(fileName);

                    uploadedUrls.push(publicUrl);
                }
            }
        }

        // proof_image_url is just the cover image; only fill it when the expense has none.
        if (uploadedUrls.length > 0 && !currentExpense?.proof_image_url) {
            updates.proof_image_url = uploadedUrls[0];
        }

        const { error: updateError } = await supabase
            .from('expenses')
            .update(updates)
            .eq('id', id);

        if (updateError) {
            console.error('Update error:', updateError);
            return fail(500, { error: 'เกิดข้อผิดพลาดในการแก้ไข กรุณาลองใหม่อีกครั้ง' });
        }

        // Insert Attachments
        if (uploadedUrls.length > 0) {
            const attachments = uploadedUrls.map(url => ({
                expense_id: id,
                file_url: url,
                file_type: 'image'
            }));

            const { error: attachmentError } = await supabase
                .from('expense_attachments')
                .insert(attachments);

            if (attachmentError) {
                console.error('Attachment Insert Error:', attachmentError);
            }
        }

        throw redirect(303, `/expenses/${id}`);
    },

    deleteAttachment: async ({ request, params, locals: { supabase } }) => {
        const { id } = params;
        const formData = await request.formData();
        const attachmentId = formData.get('attachment_id') as string;

        if (!attachmentId) {
            return fail(400, { error: 'ไม่พบไฟล์ที่ต้องการลบ' });
        }

        const { data: attachment } = await supabase
            .from('expense_attachments')
            .select('file_url')
            .eq('id', attachmentId)
            .single();

        const { error: deleteError } = await supabase
            .from('expense_attachments')
            .delete()
            .eq('id', attachmentId);

        if (deleteError) {
            console.error('Delete attachment error:', deleteError);
            return fail(500, { error: 'เกิดข้อผิดพลาดในการลบไฟล์ กรุณาลองใหม่อีกครั้ง' });
        }

        // Keep the cover image in sync: if we just removed it, promote another
        // attachment (or clear it) so the detail page never renders a dead URL.
        const { data: expense } = await supabase
            .from('expenses')
            .select('proof_image_url')
            .eq('id', id)
            .single();

        if (attachment?.file_url && expense?.proof_image_url === attachment.file_url) {
            const { data: remaining } = await supabase
                .from('expense_attachments')
                .select('file_url')
                .eq('expense_id', id)
                .limit(1);

            await supabase
                .from('expenses')
                .update({ proof_image_url: remaining?.[0]?.file_url ?? null })
                .eq('id', id);
        }

        return { success: true, deleted: true };
    }
};
