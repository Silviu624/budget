/**
 * Money and percent formatting / parsing, exactly as BUILD_BRIEF §5.
 * Amounts are integer euro cents. Output: `1.400,00 €` with U+00A0 before € and U+2212 for minus.
 */

export const NBSP = ' ';
export const MINUS = '−';

export class MoneyParseError extends Error {
  constructor(message = 'Sumă invalidă') {
    super(message);
    this.name = 'MoneyParseError';
  }
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** `140050 → "1.400,50"` (no currency sign, no minus). Used inside money inputs. */
export function formatNumber(cents: number): string {
  const abs = Math.abs(Math.round(cents));
  const euros = Math.floor(abs / 100);
  const rest = abs % 100;
  return `${groupThousands(String(euros))},${String(rest).padStart(2, '0')}`;
}

/** `140000 → "1.400,00 €"`, `-60000 → "−600,00 €"`, with `sign: true` `80000 → "+800,00 €"`. */
export function formatEUR(cents: number, options: { sign?: boolean } = {}): string {
  const body = `${formatNumber(cents)}${NBSP}€`;
  if (cents < 0) {
    return `${MINUS}${body}`;
  }
  if (options.sign && cents > 0) {
    return `+${body}`;
  }
  return body;
}

/**
 * Parses what a person types into a money field and returns integer cents.
 * If the text contains `,` then `.` is a thousands separator and `,` the decimal mark; otherwise a
 * final `.` followed by 1–2 digits is a decimal point and any other `.` is a thousands separator.
 */
export function parseMoney(text: string): number {
  let s = text.replace(/[\s €]/g, '').replace(MINUS, '-');
  if (s === '' || s === '-') {
    throw new MoneyParseError();
  }
  let negative = false;
  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1);
  }
  let integerPart: string;
  let decimalPart = '';
  if (s.includes(',')) {
    const parts = s.split(',');
    if (parts.length !== 2) {
      throw new MoneyParseError();
    }
    integerPart = parts[0].replace(/\./g, '');
    decimalPart = parts[1];
  } else {
    const match = /^(.*)\.(\d{1,2})$/.exec(s);
    if (match) {
      integerPart = match[1].replace(/\./g, '');
      decimalPart = match[2];
    } else {
      integerPart = s.replace(/\./g, '');
    }
  }
  if (integerPart === '') {
    integerPart = '0';
  }
  if (!/^\d+$/.test(integerPart) || !/^\d{0,2}$/.test(decimalPart)) {
    throw new MoneyParseError();
  }
  const cents = Number(integerPart) * 100 + Number(decimalPart.padEnd(2, '0') || '0');
  if (!Number.isSafeInteger(cents)) {
    throw new MoneyParseError();
  }
  return negative ? -cents : cents;
}

/** `20 → "20%"`, `95.555 → "95,6%"`. */
export function formatPercent(percent: number): string {
  const rounded = Math.round(percent * 10) / 10;
  return `${String(rounded).replace('.', ',')}%`;
}

/** Percent input: 0–100, one decimal, `,` or `.` accepted. */
export function parsePercent(text: string): number {
  const s = text.replace(/[\s%]/g, '').replace(',', '.');
  if (!/^\d{1,3}(\.\d)?$/.test(s)) {
    throw new MoneyParseError('Procent invalid');
  }
  const value = Number(s);
  if (value < 0 || value > 100) {
    throw new MoneyParseError('Procent invalid');
  }
  return value;
}

/** Percent with one decimal → integer tenths (`20 → 200`, `2.5 → 25`). */
export function toTenths(percent: number): number {
  return Math.round(percent * 10);
}
