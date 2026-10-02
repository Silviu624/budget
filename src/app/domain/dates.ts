/** Month keys (yyyy-mm), Romanian month labels and date formatting. Time zone: Europe/Bucharest. */

export const TIME_ZONE = 'Europe/Bucharest';

export const MONTH_NAMES = [
  'Ianuarie',
  'Februarie',
  'Martie',
  'Aprilie',
  'Mai',
  'Iunie',
  'Iulie',
  'August',
  'Septembrie',
  'Octombrie',
  'Noiembrie',
  'Decembrie',
];

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function parseMonthKey(key: string): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) {
    throw new Error(`Invalid month key: ${key}`);
  }
  return { year: Number(match[1]), month: Number(match[2]) };
}

export function isMonthKey(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) {
    return false;
  }
  const { month } = parseMonthKey(value);
  return month >= 1 && month <= 12;
}

export function addMonths(key: string, delta: number): string {
  const { year, month } = parseMonthKey(key);
  const index = year * 12 + (month - 1) + delta;
  return monthKey(Math.floor(index / 12), (index % 12) + 1);
}

export function compareMonthKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** `"2026-10" → "Octombrie 2026"`. */
export function monthLabel(key: string): string {
  const { year, month } = parseMonthKey(key);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

interface Parts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
}

function partsInBucharest(date: Date): Parts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
}

/** Calendar month in Europe/Bucharest, as yyyy-mm. */
export function currentMonthKey(now: Date = new Date()): string {
  const { year, month } = partsInBucharest(now);
  return `${year}-${month}`;
}

/** Today in Europe/Bucharest, as yyyy-mm-dd. */
export function todayISO(now: Date = new Date()): string {
  const { year, month, day } = partsInBucharest(now);
  return `${year}-${month}-${day}`;
}

/** `"2026-09-02" → "02.09.2026"`. */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-');
  return `${day}.${month}.${year}`;
}

/** ISO date-time → `"02.10.2026 la 09:14"` in Europe/Bucharest. */
export function formatDateTime(iso: string): string {
  const { year, month, day, hour, minute } = partsInBucharest(new Date(iso));
  return `${day}.${month}.${year} la ${hour}:${minute}`;
}
