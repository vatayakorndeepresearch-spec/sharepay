/** Thai locale defaults to the Buddhist calendar, which disagrees with every
 *  `<input type="date">` in the app. Pin the Gregorian calendar everywhere. */
const LOCALE = 'th-TH-u-ca-gregory';

export const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString(LOCALE, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

/** `2026-08-02` -> `วันนี้` / `เมื่อวาน` / `อา. 2 ส.ค.` (year only when not the current one). */
export const formatDateGroup = (dateString: string, today = new Date()) => {
    if (!dateString) return '';

    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateString;

    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diffDays = Math.round((startOfToday.getTime() - date.getTime()) / 86_400_000);

    if (diffDays === 0) return 'วันนี้';
    if (diffDays === 1) return 'เมื่อวาน';

    return date.toLocaleDateString(LOCALE, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        ...(date.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' })
    });
};

/** `2026-08` -> `สิงหาคม 2026` */
export const formatMonth = (month: string) => {
    if (!month || month === 'all') return 'ทุกเดือน';
    return new Date(`${month}-15T00:00:00`).toLocaleDateString(LOCALE, {
        month: 'long',
        year: 'numeric'
    });
};
