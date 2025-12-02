import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import QRCode from 'qrcode';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
    const { data: factors, error } = await supabase.auth.mfa.listFactors();

    if (error) {
        console.error('Error listing factors:', error);
        return { isEnabled: false };
    }

    const verifiedFactors = factors.all.filter(f => f.status === 'verified');
    return {
        isEnabled: verifiedFactors.length > 0
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

    logout: async ({ locals: { supabase } }) => {
        await supabase.auth.signOut();
        throw redirect(303, '/login');
    }
};
