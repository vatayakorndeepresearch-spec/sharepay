import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import QRCode from 'qrcode';

export const load: PageServerLoad = async ({ locals: { supabase }, parent }) => {
    const [{ data: factors, error }, { data: projects, error: projectsError }, { currentUser }] =
        await Promise.all([
            supabase.auth.mfa.listFactors(),
            supabase.from('projects').select('id, name, is_active').order('name'),
            parent()
        ]);

    if (error) {
        console.error('Error listing factors:', error);
    }
    if (projectsError) {
        console.error('Error fetching projects:', projectsError);
    }

    return {
        isEnabled: (factors?.all ?? []).some((factor) => factor.status === 'verified'),
        projects: projects || [],
        currentUser
    };
};

export const actions: Actions = {
    enroll: async ({ locals: { supabase } }) => {
        // First, clean up any existing factors (verified or unverified) to prevent collisions
        const { data: factors } = await supabase.auth.mfa.listFactors();
        if (factors && factors.all) {
            for (const factor of factors.all) {
                await supabase.auth.mfa.unenroll({ factorId: factor.id });
            }
        }

        const { data, error } = await supabase.auth.mfa.enroll({
            factorType: 'totp',
            friendlyName: 'SharePay',
        });

        if (error) {
            return fail(500, { error: 'ไม่สามารถสร้าง 2FA ได้: ' + error.message });
        }

        // Generate QR Code if Supabase doesn't provide it (or just to be safe/consistent)
        // Supabase usually provides data.totp.qr_code but sometimes it's SVG string, sometimes data URI.
        // Let's generate our own PNG data URI using the qrcode package for better compatibility.
        let qrImageUrl = data.totp.qr_code;

        try {
            qrImageUrl = await QRCode.toDataURL(data.totp.uri);
        } catch (err) {
            console.error('Error generating QR:', err);
        }

        return {
            qr: qrImageUrl,
            factorId: data.id,
            secret: data.totp.secret
        };
    },

    verify: async ({ request, locals: { supabase } }) => {
        const formData = await request.formData();
        const code = formData.get('code') as string;
        const factorId = formData.get('factorId') as string;

        if (!code || !factorId) {
            return fail(400, { error: 'ข้อมูลไม่ครบถ้วน' });
        }

        const { data, error } = await supabase.auth.mfa.challenge({ factorId });

        if (error) {
            return fail(500, { error: 'Challenge failed: ' + error.message });
        }

        const verify = await supabase.auth.mfa.verify({
            factorId,
            challengeId: data.id,
            code,
        });

        if (verify.error) {
            return fail(400, { error: 'รหัสไม่ถูกต้อง กรุณาลองใหม่' });
        }

        // Success!
        return { success: true };
    },

    disable: async ({ locals: { supabase } }) => {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const verifiedFactors = factors?.all.filter(f => f.status === 'verified') || [];

        for (const factor of verifiedFactors) {
            await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }

        return { success: true };
    },

    createProject: async ({ request, locals: { supabase } }) => {
        const formData = await request.formData();
        const name = (formData.get('name') as string)?.trim();

        if (!name) {
            return fail(400, { error: 'กรุณาตั้งชื่อโปรเจค' });
        }

        const { error } = await supabase.from('projects').insert({ name, is_active: true });

        if (error) {
            console.error('Create project error:', error);
            return fail(500, { error: 'สร้างโปรเจคไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
        }

        return { success: true };
    },

    toggleProject: async ({ request, locals: { supabase } }) => {
        const formData = await request.formData();
        const projectId = formData.get('project_id') as string;
        const isActive = formData.get('is_active') === 'true';

        if (!projectId) {
            return fail(400, { error: 'ไม่พบโปรเจคที่ต้องการแก้ไข' });
        }

        const { error } = await supabase
            .from('projects')
            .update({ is_active: !isActive })
            .eq('id', projectId);

        if (error) {
            console.error('Toggle project error:', error);
            return fail(500, { error: 'อัปเดตโปรเจคไม่สำเร็จ' });
        }

        return { success: true };
    },

    logout: async ({ locals: { supabase } }) => {
        await supabase.auth.signOut();
        throw redirect(303, '/login');
    }
};
