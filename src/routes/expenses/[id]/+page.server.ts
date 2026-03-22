import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase }, parent }) => {
    const { id } = params;
    const { currentProfileId, currentUser } = await parent();

    const { data: expense } = await supabase
        .from('expenses')
        .select(`
      *,
      projects (name),
      profiles!expenses_paid_by_fkey (display_name),
      reimburser:profiles!expenses_reimbursed_by_fkey (display_name)
    `)
        .eq('id', id)
        .single();

    if (!expense) {
        throw error(404, 'ไม่พบรายการนี้');
    }

    // Load profiles for reimbursement selection
    const { data: profiles } = await supabase.from('profiles').select('*');

    // Load attachments
    const { data: attachments } = await supabase
        .from('expense_attachments')
        .select('*')
        .eq('expense_id', id);

    return {
        expense: { ...expense, attachments: attachments || [] },
        profiles: profiles || [],
        currentProfileId,
        currentUser
    };
};

export const actions: Actions = {
    reimburse: async ({ request, params, locals: { supabase } }) => {
        const { id } = params;
        const formData = await request.formData();
        const reimbursedBy = formData.get('reimbursed_by') as string;
        const file = formData.get('proof_image') as File;

        let reimbursementProofUrl = null;

        // Handle File Upload
        if (file && file.size > 0) {
            if (file.size > 5 * 1024 * 1024) {
                return fail(400, { error: 'รูปภาพต้องมีขนาดไม่เกิน 5MB' });
            }

            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic'];
            const allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'];
            const fileExt = file.name.split('.').pop()?.toLowerCase();
            if (!fileExt || !allowedExts.includes(fileExt) || !allowedTypes.includes(file.type)) {
                return fail(400, { error: 'อนุญาตเฉพาะไฟล์รูปภาพ (JPG, PNG, GIF, WebP, HEIC)' });
            }

            const fileName = `reimbursements/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('expense_proofs')
                .upload(fileName, file);

            if (uploadError) {
                console.error('Upload error:', uploadError);
                return fail(500, { error: 'อัพโหลดรูปไม่สำเร็จ' });
            }

            const { data: { publicUrl } } = supabase.storage
                .from('expense_proofs')
                .getPublicUrl(fileName);

            reimbursementProofUrl = publicUrl;
        }

        const { error: updateError } = await supabase
            .from('expenses')
            .update({
                is_reimbursed: true,
                reimbursed_at: new Date().toISOString(),
                reimbursed_by: reimbursedBy || null,
                reimbursement_proof_url: reimbursementProofUrl
            })
            .eq('id', id);

        if (updateError) {
            console.error('Reimburse error:', updateError);
            return fail(500, { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
        }

        return { success: true };
    },

    unreimburse: async ({ params, locals: { supabase } }) => {
        const { id } = params;

        const { error: updateError } = await supabase
            .from('expenses')
            .update({
                is_reimbursed: false,
                reimbursed_at: null,
                reimbursed_by: null,
                reimbursement_proof_url: null
            })
            .eq('id', id);

        if (updateError) {
            console.error('Unreimburse error:', updateError);
            return fail(500, { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
        }

        return { success: true };
    },

    delete: async ({ params, locals: { supabase } }) => {
        const { id } = params;

        const { error: deleteError } = await supabase
            .from('expenses')
            .delete()
            .eq('id', id);

        if (deleteError) {
            console.error('Delete error:', deleteError);
            return fail(500, { error: 'เกิดข้อผิดพลาดในการลบ กรุณาลองใหม่อีกครั้ง' });
        }

        throw redirect(303, '/expenses');
    }
};
