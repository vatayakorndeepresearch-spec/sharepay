import { redirect } from '@sveltejs/kit';
import { isAllowedEmail } from '$lib/server/allowedUsers';

export const GET = async ({ url, locals: { supabase } }) => {
    const code = url.searchParams.get('code');
    const next = url.searchParams.get('next') ?? '/';

    if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            if (!isAllowedEmail(data.user?.email)) {
                await supabase.auth.signOut();
                throw redirect(303, '/login?error=NotAllowed');
            }

            // Check if user has MFA enabled
            const { data: factors } = await supabase.auth.mfa.listFactors();
            const hasVerifiedFactors = factors?.all?.some(f => f.status === 'verified');

            if (hasVerifiedFactors) {
                throw redirect(303, '/auth/mfa/verify');
            }

            throw redirect(303, next);
        }
    }

    // Return the user to an error page with instructions
    throw redirect(303, '/login?error=AuthCodeError');
};
