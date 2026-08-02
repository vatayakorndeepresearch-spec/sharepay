import { browser } from '$app/environment';
import type { TransactionType } from './expenseForm';

const KEY = 'sharepay:recent-categories';
const MAX = 6;

type Store = Partial<Record<TransactionType, string[]>>;

function read(): Store {
    if (!browser) return {};
    try {
        return JSON.parse(localStorage.getItem(KEY) || '{}') as Store;
    } catch {
        return {};
    }
}

export function getRecentCategories(type: TransactionType, fallback: readonly string[]): string[] {
    const stored = read()[type] ?? [];
    const merged = [...stored, ...fallback.filter((item) => !stored.includes(item))];
    return merged.slice(0, MAX);
}

export function rememberCategory(type: TransactionType, category: string) {
    if (!browser || !category) return;
    const store = read();
    const next = [category, ...(store[type] ?? []).filter((item) => item !== category)].slice(0, MAX);
    try {
        localStorage.setItem(KEY, JSON.stringify({ ...store, [type]: next }));
    } catch {
        // Storage unavailable — recents are a convenience, not a requirement.
    }
}
