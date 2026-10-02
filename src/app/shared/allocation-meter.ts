import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Plan } from '../domain/allocation';
import { formatEUR, formatPercent } from '../domain/money';
import { Icon } from './icon';

/** Shows live how much of „Rămas de împărțit” the percentages cover. */
@Component({
  selector: 'bu-allocation-meter',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'bu-meter' },
  template: `
    <div class="bu-between">
      <span class="label bu-muted">Alocat din {{ remainder() }}</span>
      <span class="body-strong bu-num" [class.bu-neg]="over()">{{ percentText() }}</span>
    </div>
    <div
      class="bar"
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="100"
      [attr.aria-valuenow]="valueNow()"
      [attr.aria-valuetext]="statusText()"
    >
      @if (over()) {
        <i [style.width.%]="10000 / total()"></i>
        <i class="over" [style.width.%]="100 - 10000 / total()"></i>
        <span class="tick" [style.left.%]="10000 / total()"></span>
      } @else {
        <i [style.width.%]="total()"></i>
      }
    </div>
    <div class="status" [class.bu-muted]="under()" [class.bu-neg]="over()">
      @if (complete()) {
        <bu-icon name="check" [size]="14" class="bu-accent" />
      }
      <span>{{ statusText() }}</span>
    </div>
  `,
})
export class AllocationMeter {
  readonly plan = input.required<Plan>();

  protected readonly total = computed(() => this.plan().percentTotal);
  protected readonly complete = computed(() => this.total() === 100);
  protected readonly under = computed(() => this.total() < 100);
  protected readonly over = computed(() => this.total() > 100);
  protected readonly valueNow = computed(() => Math.min(100, this.total()));
  protected readonly remainder = computed(() => formatEUR(Math.max(0, this.plan().remainderCents)));
  protected readonly percentText = computed(() => formatPercent(this.total()));
  protected readonly statusText = computed(() => {
    const plan = this.plan();
    if (this.complete()) {
      return `Totul este alocat · nealocat ${formatEUR(0)}`;
    }
    if (this.under()) {
      return `Nealocat: ${formatPercent(100 - this.total())} · ${formatEUR(plan.unallocatedCents)}`;
    }
    return `Peste 100% cu ${formatPercent(this.total() - 100)} · ${formatEUR(plan.unallocatedCents)}`;
  });
}
