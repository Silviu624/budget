import { describe, expect, it } from 'vitest';
import { formatEUR, formatNumber, formatPercent, MINUS, MoneyParseError, NBSP, parseMoney, parsePercent } from './money';

describe('formatEUR', () => {
  it.each([
    [140000, '1.400,00'],
    [6842000, '68.420,00'],
    [0, '0,00'],
    [99, '0,99'],
    [100000000, '1.000.000,00'],
  ])('formats %i', (cents, expected) => {
    expect(formatEUR(cents)).toBe(`${expected}${NBSP}€`);
  });

  it('uses the true minus sign', () => {
    expect(formatEUR(-60000)).toBe(`${MINUS}600,00${NBSP}€`);
  });

  it('adds a plus sign on request, but never on zero', () => {
    expect(formatEUR(80000, { sign: true })).toBe(`+800,00${NBSP}€`);
    expect(formatEUR(0, { sign: true })).toBe(`0,00${NBSP}€`);
  });

  it('formats plain numbers for inputs', () => {
    expect(formatNumber(1000000)).toBe('10.000,00');
  });
});

describe('parseMoney', () => {
  it.each([
    ['1.400,50', 140050],
    ['1400,5', 140050],
    ['1400.50', 140050],
    ['1.400', 140000],
    ['10.000,00 €', 1000000],
    ['0,99', 99],
    ['7', 700],
  ])('parses %s', (text, cents) => {
    expect(parseMoney(text)).toBe(cents);
  });

  it.each(['abc', '1,234', '', '1,2,3', '1.2.3,4,5'])('rejects %s', (text) => {
    expect(() => parseMoney(text)).toThrow(MoneyParseError);
  });
});

describe('percent', () => {
  it('formats with one decimal and a comma', () => {
    expect(formatPercent(95.555)).toBe('95,6%');
    expect(formatPercent(20)).toBe('20%');
    expect(formatPercent(2.5)).toBe('2,5%');
  });

  it('parses comma or dot, 0–100, one decimal', () => {
    expect(parsePercent('20')).toBe(20);
    expect(parsePercent('2,5')).toBe(2.5);
    expect(parsePercent('2.5 %')).toBe(2.5);
    expect(parsePercent('100')).toBe(100);
    for (const bad of ['101', '2,55', 'abc', '']) {
      expect(() => parsePercent(bad)).toThrow(MoneyParseError);
    }
  });
});
