import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig(({ mode }) => ({
	// The self-signed cert only exists to test the PWA over https on a phone in dev.
	plugins: [sveltekit(), ...(mode === 'development' ? [basicSsl()] : [])],
	// The slip worker code-splits jsqr, which rules out the default iife worker format.
	worker: { format: 'es' },
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'node'
	}
}));
