export const expenseCategories = [
    'อาหาร',
    'เดินทาง',
    'ของใช้',
    'ที่พัก',
    'สุขภาพ',
    'บันเทิง',
    'ช้อปปิ้ง',
    'ค่าน้ำ',
    'ค่าไฟ',
    'ค่าโทรศัพท์',
    'ค่าอินเตอร์เน็ต',
    'ค่าสมาชิก/Sub',
    'ค่าเช่าบ้าน',
    'ค่าชาร์จรถ',
    'ค่าน้ำมัน',
    'ประกัน',
    'การศึกษา',
    'สัตว์เลี้ยง',
    'บริจาค/ทำบุญ'
] as const;

export const incomeCategories = [
    'เงินเดือน',
    'โบนัส',
    'ฟรีแลนซ์',
    'การลงทุน',
    'ของขวัญ',
    'เงินคืน'
] as const;

const thaiMonthMap: Record<string, number> = {
    มค: 1,
    กพ: 2,
    มีค: 3,
    เมย: 4,
    พค: 5,
    มิย: 6,
    กค: 7,
    สค: 8,
    กย: 9,
    ตค: 10,
    พย: 11,
    ธค: 12,
    มกราคม: 1,
    กุมภาพันธ์: 2,
    มีนาคม: 3,
    เมษายน: 4,
    พฤษภาคม: 5,
    มิถุนายน: 6,
    กรกฎาคม: 7,
    สิงหาคม: 8,
    กันยายน: 9,
    ตุลาคม: 10,
    พฤศจิกายน: 11,
    ธันวาคม: 12,
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12,
    '5m': 12,
    sm: 12,
    '8m': 12,
    's.m': 12,
    '5.m': 12,
    sh: 12,
    '5h': 12,
    sk: 12,
    sn: 12,
    '5n': 12,
    '5k': 12,
    '1m': 1,
    nm: 1,
    wk: 1,
    mk: 1,
    nw: 2,
    'n.w': 2,
    aw: 2,
    'a.w': 2
};

export type TransactionType = 'expense' | 'income';

export interface ExtractedExpenseData {
    amount: number | null;
    date: string;
    notes: string;
    description: string;
    highlightedFields: string[];
}

export function getTodayLocalDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function getCategories(type: TransactionType) {
    return type === 'income' ? [...incomeCategories] : [...expenseCategories];
}

function parseAmount(lines: string[]) {
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const sameLineMatch = line.match(/(?:จำนวน|จํานวน|amount)\s*[:.]?\s*([\d,]+\.?\d*)/i);
        if (sameLineMatch?.[1]) {
            const amount = parseFloat(sameLineMatch[1].replace(/,/g, ''));
            if (!Number.isNaN(amount) && amount > 0) {
                return amount;
            }
        }

        if (line.match(/(?:จำนวน|จํานวน)\s*[:.]?\s*$/i) && i + 1 < lines.length) {
            const nextMatch = lines[i + 1]
                .trim()
                .match(/([\d,]+\.?\d*)\s*(?:บาท|THB)?/i);
            if (nextMatch?.[1]) {
                const amount = parseFloat(nextMatch[1].replace(/,/g, ''));
                if (!Number.isNaN(amount) && amount > 0) {
                    return amount;
                }
            }
        }
    }

    for (const line of lines) {
        if (line.match(/ค่าธรรมเนียม|fee/i)) continue;
        const match = line.match(/([\d,]+\.\d{2})\s*(?:บาท|THB)/i);
        if (match?.[1]) {
            const amount = parseFloat(match[1].replace(/,/g, ''));
            if (!Number.isNaN(amount) && amount > 0) {
                return amount;
            }
        }
    }

    return null;
}

function parseDate(lines: string[]) {
    let dateLine: string | null = null;

    for (const line of lines) {
        if (line.includes('วันที่') || line.includes('วนท') || line.includes('วันท')) {
            dateLine = line;
            break;
        }

        if ((line.match(/\d{1,2}:\d{2}/) || line.includes('น.') || line.includes('น,')) && line.match(/^\d{1,2}\s/)) {
            dateLine = line;
            break;
        }
    }

    if (!dateLine) {
        for (const line of lines) {
            if (line.match(/^\d{1,2}\s+[ก-๙a-zA-Z0-9.\-]+\s+\d{2,4}/)) {
                dateLine = line;
                break;
            }
        }
    }

    if (!dateLine) {
        return getTodayLocalDate();
    }

    const dateMatch =
        dateLine.match(/^(\d{1,2})[\s./-]+([ก-๙a-zA-Z0-9.\-]+)[\s./-]+(\d{2,4})/) ||
        dateLine.match(/(?:วันที่|วนท|วันท)[\s:]*(\d{1,2})[\s./-]+([ก-๙a-zA-Z0-9.\-]+)[\s./-]+(\d{2,4})/);

    if (!dateMatch) {
        return getTodayLocalDate();
    }

    const day = parseInt(dateMatch[1], 10);
    const monthKey = dateMatch[2].toLowerCase().replace(/[\s.-]/g, '');
    const rawYear = parseInt(dateMatch[3], 10);

    let month = thaiMonthMap[monthKey];
    if (!month) {
        for (const [key, value] of Object.entries(thaiMonthMap)) {
            if (monthKey.length >= 2 && (monthKey.startsWith(key) || key.startsWith(monthKey) || monthKey.includes(key))) {
                month = value;
                break;
            }
        }
    }

    if (!month) {
        if ((monthKey.includes('m') || monthKey.includes('n') || monthKey.includes('k') || monthKey.includes('h')) &&
            (monthKey.includes('5') || monthKey.includes('s') || monthKey.includes('8'))) {
            month = 12;
        }
        if (monthKey.includes('ค') || monthKey.includes('ธ')) month = 12;
        if (monthKey.includes('ม') && (monthKey.includes('ค') || monthKey.length <= 3)) month = 1;
    }

    if (!month || day < 1 || day > 31) {
        return getTodayLocalDate();
    }

    let year = rawYear;
    if (year > 2500) year -= 543;
    else if (year < 100) year = year > 40 ? 2500 + year - 543 : 2000 + year;

    if (year < 2000 || year > 2100) {
        return getTodayLocalDate();
    }

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseNote(lines: string[]) {
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const labelMatch = line.match(/(?:บันทึกช่วยจำ|บันทึกช่วยจํา|Note|Memo)/i);
        if (!labelMatch) continue;

        let content = line.substring(labelMatch.index! + labelMatch[0].length).replace(/^[:.\s]+/, '').trim();
        if (!content && i + 1 < lines.length) {
            content = lines[i + 1].trim();
        }

        if (content) {
            return content;
        }
    }

    for (let i = lines.length - 1; i >= 0; i--) {
        const fallbackMatch = lines[i].trim().match(/ค่า[ก-๙a-zA-Z]+/);
        if (fallbackMatch?.[0]) {
            return fallbackMatch[0];
        }
    }

    return '';
}

export function extractExpenseData(text: string): ExtractedExpenseData {
    const lines = text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    const amount = parseAmount(lines);
    const date = parseDate(lines);
    const notes = parseNote(lines);
    const description = notes;

    const highlightedFields: string[] = [];
    if (amount) highlightedFields.push('amount');
    if (date) highlightedFields.push('date');
    if (notes) highlightedFields.push('notes', 'description');

    return {
        amount,
        date,
        notes,
        description,
        highlightedFields
    };
}
