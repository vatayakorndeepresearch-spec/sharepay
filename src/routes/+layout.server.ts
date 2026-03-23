import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { user } }) => {
    let currentProfileId: string | null = null;
    let currentUser: { name: string; email: string; avatar_url: string } | null = null;

    if (user) {
        currentProfileId = user.id;

        currentUser = {
            name: user.user_metadata?.full_name || user.email,
            email: user.email ?? '',
            avatar_url: user.user_metadata?.avatar_url || ''
        };
    }

    return { currentProfileId, currentUser };
};
