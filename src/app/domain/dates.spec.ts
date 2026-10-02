import { describe, expect, it } from 'vitest';
import { addMonths, currentMonthKey, formatDate, formatDateTime, monthLabel, todayISO } from './dates';

describe('dates', () => {
  it('labels months in Romanian', () => {
    expect(monthLabel('2026-10')).toBe('Octombrie 2026');
    expect(monthLabel('2026-01')).toBe('Ianuarie 2026');
  });

  it('moves across year boundaries', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-05', 7)).toBe('2026-12');
  });

  it('formats dates and date-times', () => {
    expect(formatDate('2026-09-02')).toBe('02.09.2026');
    expect(formatDateTime('2026-10-02T09:14:00+03:00')).toBe('02.10.2026 la 09:14');
  });

  it('uses the Bucharest calendar day', () => {
    // 22:30 UTC on 31 October is already 1 November in Bucharest (UTC+2 after the DST change).
    const late = new Date('2026-10-31T22:30:00Z');
    expect(currentMonthKey(late)).toBe('2026-11');
    expect(todayISO(late)).toBe('2026-11-01');
  });
});
