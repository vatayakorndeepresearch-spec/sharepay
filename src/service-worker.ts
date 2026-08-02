/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `sharepay-${version}`;
// Only the hashed JS/CSS the shell needs to paint — icons and other static files
// would fight first paint for bandwidth, so they get cached the first time they're fetched.
const PRECACHE = [...build];
const RUNTIME_CACHEABLE = new Set(files);

sw.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(CACHE)
            .then((cache) => cache.addAll(PRECACHE))
            .then(() => sw.skipWaiting())
    );
});

sw.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
            .then(() => sw.clients.claim())
    );
});

sw.addEventListener('fetch', (event) => {
    const { request } = event;

    // Never cache mutations or anything that depends on the session.
    if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;

    const { pathname } = new URL(request.url);

    event.respondWith(
        (async () => {
            const cached = await caches.match(request);
            if (PRECACHE.includes(pathname) && cached) {
                return cached;
            }

            try {
                const response = await fetch(request);
                if (RUNTIME_CACHEABLE.has(pathname) && response.ok) {
                    const cache = await caches.open(CACHE);
                    void cache.put(request, response.clone());
                }
                return response;
            } catch (error) {
                if (cached) return cached;
                throw error;
            }
        })()
    );
});
