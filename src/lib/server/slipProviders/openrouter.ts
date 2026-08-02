import { env } from '$env/dynamic/private';
import type { SlipExtraction, SlipQrHint } from '$lib/types/slip';
import { SlipProviderError, firstChoiceContent, parseModelJson, postJson } from './errors';
import { normalizeExtraction } from './normalize';
import { STRUCTURING_PROMPT, buildStructuringUserMessage } from './prompt';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const DEFAULT_OPENROUTER_MODEL = 'google/gemini-2.5-flash';

/** Provider B: one multimodal call — image in, structured JSON out. */
export async function extractWithOpenRouter(
    imageBase64: string,
    mimeType: string,
    hint: SlipQrHint | null,
    signal: AbortSignal
): Promise<{ extraction: SlipExtraction; model: string }> {
    const apiKey = env.OPENROUTER_API_KEY;
    if (!apiKey) throw new SlipProviderError('config', 'OPENROUTER_API_KEY is not configured');

    const model = env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL;

    const payload = await postJson(
        OPENROUTER_URL,
        apiKey,
        {
            model,
            temperature: 0,
            max_tokens: 900,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: STRUCTURING_PROMPT },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: buildStructuringUserMessage('(read the attached slip image)', hint ?? undefined) },
                        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
                    ]
                }
            ]
        },
        signal,
        { 'X-Title': 'SharePay slip extraction' }
    );

    const raw = parseModelJson(firstChoiceContent(payload));
    return { extraction: normalizeExtraction(raw, hint), model };
}
