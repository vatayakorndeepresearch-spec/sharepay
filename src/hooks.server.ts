import { createServerClient } from '@supabase/ssr';
import { type Handle } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { isAllowedEmail } from '$lib/server/allowedUsers';

export const handle: Handle = async ({ event, resolve }) => {
    event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
        cookies: {
            getAll: () => event.cookies.getAll(),
            setAll: (cookiesToSet) => {
                cookiesToSet.forEach(({ name, value, options }) => {
                    event.cookies.set(name, value, {
                        ...options,
                        path: '/',
                        // Plain-http local dev would silently drop a `secure` cookie.
                        secure: event.url.protocol === 'https:',
                        sameSite: 'lax',
                        maxAge: 60 * 60 * 24 * 10 // 10 days
                    });
                });
            },
        },
    });

    const {
        data: { user: signedInUser },
    } = await event.locals.supabase.auth.getUser();

    // Two-person app: any other account gets its session torn down on sight.
    let user = signedInUser;
    if (user && !isAllowedEmail(user.email)) {
        await event.locals.supabase.auth.signOut();
        user = null;
        if (!event.url.pathname.startsWith('/api/')) {
            return new Response(null, {
                status: 303,
                headers: { location: '/login?error=NotAllowed' },
            });
        }
    }

    event.locals.user = user ?? null;
    event.locals.session = user ? { user } as any : null;

    // API routes answer with JSON 401 instead of a redirect the client cannot follow
    if (!user && event.url.pathname.startsWith('/api/')) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
            status: 401,
            headers: { 'content-type': 'application/json' }
        });
    }

    // Protect routes
    if (!user && !event.url.pathname.startsWith('/login') && !event.url.pathname.startsWith('/auth')) {
        return new Response(null, {
            status: 303,
            headers: { location: '/login' },
        });
    }

    // If logged in, don't allow access to login page
    if (user && event.url.pathname.startsWith('/login')) {
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
