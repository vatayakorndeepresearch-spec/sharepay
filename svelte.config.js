import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Tailwind v3's postcss treats `@layer components` as its own directive and errors on
// dependency styles (layerchart) that use native CSS cascade layers — skip node_modules.
const vite = vitePreprocess();
const scopedVitePreprocess = {
	...vite,
	style: (options) =>
		options.filename?.includes('node_modules') ? undefined : vite.style(options)
};

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: scopedVitePreprocess,

	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter()
	}
};

export default config;
