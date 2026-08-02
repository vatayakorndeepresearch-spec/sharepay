import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

// Tailwind v3 claims `@layer base|components|utilities` as its own directives and
// errors when vendor CSS (layerchart) uses them as native cascade layers without a
// matching `@tailwind` directive. Rename vendor layers so Tailwind leaves them alone.
const preserveVendorLayers = {
  postcssPlugin: 'preserve-vendor-layers',
  Once(root) {
    const file = root.source?.input.file ?? '';
    if (!file.includes('node_modules')) return;
    root.walkAtRules('layer', (rule) => {
      if (/^(base|components|utilities)$/.test(rule.params)) {
        rule.params = `vendor-${rule.params}`;
      }
    });
  }
};

export default {
  plugins: [preserveVendorLayers, tailwindcss(), autoprefixer()]
};
