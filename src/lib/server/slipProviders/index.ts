import { env } from '$env/dynamic/private';
import type { SlipExtraction, SlipQrHint } from '$lib/types/slip';
import { SlipProviderError } from './errors';
import { extractWithOpenRouter } from './openrouter';
import { extractWithTyphoon } from './typhoon';

export type ProviderName = 'typhoon' | 'openrouter';

export const PROVIDER_TIMEOUT_MS = 12_000;

export function activeProvider(): ProviderName {
    return env.SLIP_AI_PROVIDER === 'openrouter' ? 'openrouter' : 'typhoon';
}

export interface SlipExtractResult {
    extraction: SlipExtraction;
    provider: ProviderName;
    model: string;
    latencyMs: number;
}

/** Runs the configured provider with a hard timeout; never throws raw provider errors. */
export async function extractSlip(
    imageBase64: string,
    mimeType: string,
    hint: SlipQrHint | null,
    timeoutMs = PROVIDER_TIMEOUT_MS
): Promise<SlipExtractResult> {
    const provider = activeProvider();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();

    try {
        const run = provider === 'openrouter' ? extractWithOpenRouter : extractWithTyphoon;
        const { extraction, model } = await run(imageBase64, mimeType, hint, controller.signal);
        return { extraction, provider, model, latencyMs: Date.now() - startedAt };
    } catch (err) {
        if (err instanceof SlipProviderError) throw err;
        if ((err as any)?.name === 'AbortError') {
            throw new SlipProviderError('timeout', 'Provider timed out');
        }
        throw new SlipProviderError('provider', 'Slip extraction failed', (err as Error)?.message);
    } finally {
        clearTimeout(timer);
    }
}

export { SlipProviderError } from './errors';
