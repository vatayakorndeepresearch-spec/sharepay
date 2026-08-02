export type SlipErrorKind = 'config' | 'timeout' | 'provider' | 'unextractable';

export class SlipProviderError extends Error {
    constructor(
        readonly kind: SlipErrorKind,
        message: string,
        readonly detail?: string
    ) {
        super(message);
        this.name = 'SlipProviderError';
    }

    get status(): number {
        switch (this.kind) {
            case 'timeout':
                return 504;
            case 'unextractable':
                return 422;
            case 'config':
                return 503;
            default:
                return 502;
        }
    }
}

/** Extracts the first JSON object from a model response that may be fenced or chatty. */
export function parseModelJson(content: string): Record<string, unknown> {
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const body = (fenced ? fenced[1] : content).trim();

    try {
        const direct = JSON.parse(body);
        if (direct && typeof direct === 'object') return direct as Record<string, unknown>;
    } catch {
        // fall through to brace scanning
    }

    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');
    if (start !== -1 && end > start) {
        try {
            const scanned = JSON.parse(body.slice(start, end + 1));
            if (scanned && typeof scanned === 'object') return scanned as Record<string, unknown>;
        } catch {
            // fall through
        }
    }

    throw new SlipProviderError('unextractable', 'Model did not return JSON');
}

export async function postJson(
    url: string,
    apiKey: string,
    body: unknown,
    signal: AbortSignal,
    extraHeaders: Record<string, string> = {}
): Promise<Record<string, any>> {
    let response: Response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
                ...extraHeaders
            },
            body: JSON.stringify(body),
            signal
        });
    } catch (err: any) {
        if (err?.name === 'AbortError') {
            throw new SlipProviderError('timeout', 'Provider timed out');
        }
        throw new SlipProviderError('provider', 'Provider request failed', err?.message);
    }

    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new SlipProviderError(
            'provider',
            `Provider responded ${response.status}`,
            text.slice(0, 300)
        );
    }

    return (await response.json()) as Record<string, any>;
}

export function firstChoiceContent(payload: Record<string, any>): string {
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content === 'string' && content.trim()) return content;
    throw new SlipProviderError('unextractable', 'Provider returned an empty completion');
}
