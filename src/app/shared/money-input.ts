import { Directive, effect, ElementRef, inject, input, output, signal } from '@angular/core';
import { formatNumber, parseMoney, parsePercent } from '../domain/money';

/**
 * Money field: shows `10.000,00`, accepts what people type (BUILD_BRIEF §5), reformats on blur or
 * Enter and emits the new integer cents. Invalid text reverts to the last value.
 */
@Directive({
  selector: 'input[buMoney]',
  host: {
    inputmode: 'decimal',
    autocomplete: 'off',
    '[class.invalid]': 'invalid()',
    '(focus)': 'onFocus()',
    '(input)': 'invalid.set(false)',
    '(blur)': 'commit()',
    '(keydown.enter)': 'onEnter($event)',
  },
})
export class MoneyInput {
  readonly cents = input.required<number>({ alias: 'buMoney' });
  /** Optional field: 0 is shown as empty and empty text means 0. */
  readonly optional = input(false);
  readonly centsChange = output<number>();
  readonly invalid = signal(false);
  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private editing = false;

  constructor() {
    effect(() => {
      const cents = this.cents();
      if (!this.editing) {
        this.el.value = this.display(cents);
      }
    });
  }

  protected onFocus(): void {
    this.editing = true;
    this.el.select();
  }

  protected onEnter(event: Event): void {
    event.preventDefault();
    this.el.blur();
  }

  protected commit(): void {
    this.editing = false;
    try {
      const empty = this.el.value.trim() === '';
      const parsed = this.optional() && empty ? 0 : parseMoney(this.el.value);
      if (parsed < 0) {
        throw new Error('negative');
      }
      this.el.value = this.display(parsed);
      if (parsed !== this.cents()) {
        this.centsChange.emit(parsed);
      }
    } catch {
      this.invalid.set(true);
      this.el.value = this.display(this.cents());
    }
  }

  private display(cents: number): string {
    return this.optional() && cents === 0 ? '' : formatNumber(cents);
  }
}

/** Percent field: 0–100 with one decimal, `,` or `.` accepted, shown with a comma. */
@Directive({
  selector: 'input[buPercent]',
  host: {
    inputmode: 'decimal',
    autocomplete: 'off',
    '[class.invalid]': 'invalid()',
    '(focus)': 'onFocus()',
    '(input)': 'invalid.set(false)',
    '(blur)': 'commit()',
    '(keydown.enter)': 'onEnter($event)',
  },
})
export class PercentInput {
  readonly percent = input.required<number>({ alias: 'buPercent' });
  readonly percentChange = output<number>();
  readonly invalid = signal(false);
  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private editing = false;

  constructor() {
    effect(() => {
      const percent = this.percent();
      if (!this.editing) {
        this.el.value = display(percent);
      }
    });
  }

  protected onFocus(): void {
    this.editing = true;
    this.el.select();
  }

  protected onEnter(event: Event): void {
    event.preventDefault();
    this.el.blur();
  }

  protected commit(): void {
    this.editing = false;
    try {
      const parsed = parsePercent(this.el.value);
      this.el.value = display(parsed);
      if (parsed !== this.percent()) {
        this.percentChange.emit(parsed);
      }
    } catch {
      this.invalid.set(true);
      this.el.value = display(this.percent());
    }
  }
}

function display(percent: number): string {
  return String(Math.round(percent * 10) / 10).replace('.', ',');
}
