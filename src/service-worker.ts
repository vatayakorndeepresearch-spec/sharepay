/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `sharepay-${version}`;
// Everything the app shell needs to paint without a network round trip.
const PRECACHE = [...build, ...files];

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

    event.respondWith(
        (async () => {
            const cached = await caches.match(request);
            if (PRECACHE.includes(new URL(request.url).pathname) && cached) {
                return cached;
            }

            try {
                return await fetch(request);
            } catch (error) {
                if (cached) return cached;
                throw error;
            }
        })()
    );
});
