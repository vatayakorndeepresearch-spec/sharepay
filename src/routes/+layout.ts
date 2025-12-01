import { createBrowserClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ fetch, depends }) => {
    depends('supabase:auth');

    const supabase = createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
        global: {
            fetch,
        },
        cookies: {
            get(key) { return undefined; }, // No cookies needed for anon
            set(key, value, options) { },
            remove(key, options) { }
        },
    });

    return { supabase };
};
