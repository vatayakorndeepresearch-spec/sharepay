/** SharePay is a two-person app: only these accounts may hold a session. */
export const ALLOWED_EMAILS = [
    'phoneforwatching@gmail.com',
    'sinlapinnew2000@gmail.com',
] as const;

export function isAllowedEmail(email: string | null | undefined): boolean {
    if (!email) return false;
    return ALLOWED_EMAILS.includes(email.trim().toLowerCase() as (typeof ALLOWED_EMAILS)[number]);
}
