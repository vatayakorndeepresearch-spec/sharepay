import { env } from '$env/dynamic/private';
import type { SlipExtraction, SlipQrHint } from '$lib/types/slip';
import { SlipProviderError, firstChoiceContent, parseModelJson, postJson } from './errors';
import { normalizeExtraction } from './normalize';
import { OCR_PROMPT, STRUCTURING_PROMPT, buildStructuringUserMessage } from './prompt';

const TYPHOON_URL = 'https://api.opentyphoon.ai/v1/chat/completions';
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

export const TYPHOON_MODEL = 'typhoon-ocr-preview';
export const STRUCTURING_MODEL = 'deepseek-chat';

/**
 * Provider A: Typhoon OCR (Thai document model) transcribes the slip, then
 * DeepSeek turns that text into the SlipExtraction JSON.
 */
export async function extractWithTyphoon(
    imageBase64: string,
    mimeType: string,
    hint: SlipQrHint | null,
    signal: AbortSignal
): Promise<{ extraction: SlipExtraction; model: string }> {
    const typhoonKey = env.TYPHOON_API_KEY;
    const deepseekKey = env.DEEPSEEK_API_KEY;

    if (!typhoonKey) throw new SlipProviderError('config', 'TYPHOON_API_KEY is not configured');
    if (!deepseekKey) throw new SlipProviderError('config', 'DEEPSEEK_API_KEY is not configured');

    const ocrPayload = await postJson(
        TYPHOON_URL,
        typhoonKey,
        {
            model: env.TYPHOON_MODEL || TYPHOON_MODEL,
            max_tokens: 1600,
            temperature: 0,
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: OCR_PROMPT },
                        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
                    ]
                }
            ]
        },
        signal
    );

    const ocrText = firstChoiceContent(ocrPayload).trim();
    if (ocrText.length < 8) {
        throw new SlipProviderError('unextractable', 'OCR returned no usable text');
    }

    const structured = await postJson(
        DEEPSEEK_URL,
        deepseekKey,
        {
            model: STRUCTURING_MODEL,
            temperature: 0,
            max_tokens: 800,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: STRUCTURING_PROMPT },
                { role: 'user', content: buildStructuringUserMessage(ocrText, hint ?? undefined) }
            ]
        },
        signal
    );

    const raw = parseModelJson(firstChoiceContent(structured));
    return {
        extraction: normalizeExtraction(raw, hint),
        model: `${env.TYPHOON_MODEL || TYPHOON_MODEL}+${STRUCTURING_MODEL}`
    };
}
