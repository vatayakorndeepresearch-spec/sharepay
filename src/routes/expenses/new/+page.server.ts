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
    save: async ({ request, locals: { supabase } }) => {
        console.log('Starting save action...');
        const formData = await request.formData();

        const projectId = formData.get('project_id') as string;
        const transactionType = (formData.get('transaction_type') as string) || 'expense';
        const paidBy = formData.get('paid_by') as string;
        const amount = parseFloat(formData.get('amount') as string);
        const paidAt = formData.get('paid_at') as string;
        const description = formData.get('description') as string;
        const category = (formData.get('category') as string) || 'Others';
        const notes = formData.get('notes') as string; // Added notes
        const isReimbursed = formData.get('is_reimbursed') === 'on';
        const files = formData.getAll('proof_images') as File[];
        let uploadedUrls: string[] = [];

        // Handle Multiple File Uploads
        if (files && files.length > 0) {
            for (const file of files) {
                if (file.size > 0) {
                    if (file.size > 5 * 1024 * 1024) {
                        return fail(400, { error: 'รูปภาพต้องมีขนาดไม่เกิน 5MB' });
                    }

                    const fileExt = file.name.split('.').pop();
                    const fileName = `uploads/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

                    const { error: uploadError } = await supabase.storage
                        .from('expense_proofs')
                        .upload(fileName, file);

                    if (uploadError) {
                        console.error('Upload error:', uploadError);
                        continue; // Skip failed uploads but try others
                    }

                    const { data: { publicUrl } } = supabase.storage
                        .from('expense_proofs')
                        .getPublicUrl(fileName);

                    uploadedUrls.push(publicUrl);
                }
            }
        }

        // Use the first image as the main proof_image_url for backward compatibility
        const proofImageUrl = uploadedUrls.length > 0 ? uploadedUrls[0] : null;

        // Insert Expense
        const { data: expense, error: insertError } = await supabase.from('expenses').insert({
            project_id: projectId,
            transaction_type: transactionType,
            paid_by: paidBy,
            amount,
            paid_at: paidAt,
            description,
            category,
            notes, // Included notes in the insert
            is_reimbursed: transactionType === 'income' ? true : isReimbursed,
            reimbursed_at: (transactionType === 'expense' && isReimbursed) ? new Date().toISOString() : null,
            reimbursed_by: (transactionType === 'expense' && isReimbursed) ? paidBy : null,
            proof_image_url: proofImageUrl
        }).select().single();

        if (insertError) {
            console.error('Insert Error:', insertError);
            return fail(500, { error: insertError.message });
        }

        // Insert Attachments
        if (uploadedUrls.length > 0 && expense) {
            const attachments = uploadedUrls.map(url => ({
                expense_id: expense.id,
                file_url: url,
                file_type: 'image'
            }));

            const { error: attachmentError } = await supabase
                .from('expense_attachments')
                .insert(attachments);

            if (attachmentError) {
                console.error('Attachment Insert Error:', attachmentError);
                // We don't fail the whole request if attachments fail, but we log it.
            }
        }

        console.log('Insert successful!');

        throw redirect(303, '/expenses');
    }
};
