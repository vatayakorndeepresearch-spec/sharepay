/**
 * PostgREST returns embedded relations as an object or an array depending on how the
 * relationship is inferred, so every consumer has to normalise before reading a field.
 */
type Embedded<T> = T | T[] | null | undefined;

function first<T>(value: Embedded<T>): T | undefined {
    return Array.isArray(value) ? value[0] : (value ?? undefined);
}

export function getProfileName(profile: Embedded<{ display_name?: string | null }>) {
    return first(profile)?.display_name || 'ไม่ระบุ';
}

export function getProjectName(project: Embedded<{ name?: string | null }>) {
    return first(project)?.name || 'ไม่ระบุโปรเจค';
}
