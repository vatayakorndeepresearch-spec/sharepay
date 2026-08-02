import { formatCurrency } from '$lib/utils/formatCurrency';

interface CountUpOptions {
    value: number;
    duration?: number;
    format?: (n: number) => string;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Animates a number counting up into the element. The server-rendered text is
 * left in place until the first frame, and under prefers-reduced-motion the
 * final value is set immediately with no animation.
 */
export function countUp(node: HTMLElement, options: CountUpOptions) {
    let raf = 0;
    let current = 0;

    const reducedMotion = () =>
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function run({ value, duration = 900, format = formatCurrency }: CountUpOptions) {
        cancelAnimationFrame(raf);

        if (reducedMotion() || value === current) {
            current = value;
            node.textContent = format(value);
            return;
        }

        const from = current;
        const start = performance.now();
        const tick = (now: number) => {
            const progress = Math.min(1, (now - start) / duration);
            current = from + (value - from) * easeOutCubic(progress);
            node.textContent = format(current);
            if (progress < 1) {
                raf = requestAnimationFrame(tick);
            } else {
                current = value;
            }
        };
        raf = requestAnimationFrame(tick);
    }

    run(options);

    return {
        update(next: CountUpOptions) {
            run(next);
        },
        destroy() {
            cancelAnimationFrame(raf);
        }
    };
}
