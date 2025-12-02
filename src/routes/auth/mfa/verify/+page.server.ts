import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
    verify: async ({ request, locals: { supabase } }) => {
        const formData = await request.formData();
        const code = formData.get('code') as string;

        if (!code) {
            return fail(400, { error: 'กรุณากรอกรหัสความปลอดภัย' });
        }

        // 1. Get user's verified factors
        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();

        if (factorsError) {
            console.error('Error listing factors:', factorsError);
            throw redirect(303, '/');
        }

        const verifiedFactors = factors.all.filter(f => f.status === 'verified');

        if (verifiedFactors.length === 0) {
            // No MFA enabled, redirect to home
            throw redirect(303, '/');
        }

        // 2. Verify code against the first verified factor
        const factor = verifiedFactors[0];
        const challenge = await supabase.auth.mfa.challenge({ factorId: factor.id });

        if (challenge.error) {
            return fail(500, { error: 'เกิดข้อผิดพลาดในการสร้าง Challenge' });
        }

        const verify = await supabase.auth.mfa.verify({
            factorId: factor.id,
            challengeId: challenge.data.id,
            code,
        });

        if (verify.error) {
            return fail(400, { error: 'รหัส 2FA ไม่ถูกต้อง' });
        }

        // Success!
        throw redirect(303, '/');
    },
};
