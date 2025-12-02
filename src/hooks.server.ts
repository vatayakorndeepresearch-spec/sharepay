import { createServerClient } from '@supabase/ssr';
import { type Handle } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

export const handle: Handle = async ({ event, resolve }) => {
    event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
        cookies: {
            getAll: () => event.cookies.getAll(),
            setAll: (cookiesToSet) => {
                cookiesToSet.forEach(({ name, value, options }) => {
                    event.cookies.set(name, value, {
                        ...options,
                        path: '/',
                        maxAge: 60 * 60 * 24 * 10 // 10 days
                    });
                });
            },
        },
    });

    const {
        data: { session },
    } = await event.locals.supabase.auth.getSession();

    event.locals.session = session;
    event.locals.user = session?.user || null;

    // Protect routes
    if (!session && !event.url.pathname.startsWith('/login') && !event.url.pathname.startsWith('/auth')) {
        return new Response(null, {
            status: 303,
            headers: { location: '/login' },
        });
    }

    // If logged in, don't allow access to login page
    if (session && event.url.pathname.startsWith('/login')) {
        return new Response(null, {
            status: 303,
            headers: { location: '/' },
        });
    }

    return resolve(event, {
        filterSerializedResponseHeaders(name) {
            return name === 'content-range' || name === 'x-supabase-api-version';
        },
    });
};
