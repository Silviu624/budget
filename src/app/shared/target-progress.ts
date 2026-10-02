import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatEUR, formatPercent } from '../domain/money';
import { Icon } from './icon';

/** Progress of a saving bucket towards its „Țintă”; „Fără țintă” when it has none. */
@Component({
  selector: 'bu-target-progress',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display:flex;flex-direction:column;gap:6px' },
  template: `
    @if (target(); as target) {
      <div
        class="bu-prog"
        [class.lg]="large()"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        [attr.aria-valuenow]="clamped()"
        [attr.aria-valuetext]="leftText()"
      >
        <i [style.width.%]="clamped()"></i>
      </div>
      <div class="bu-between caption bu-muted">
        <span class="bu-hstack" style="gap: 4px">
          @if (reached()) {
            <bu-icon name="check" [size]="14" class="bu-accent" />
            <span>Țintă atinsă</span>
          } @else {
            <span class="bu-num">{{ percentText() }} din {{ targetText() }}</span>
          }
        </span>
        @if (!reached()) {
          <span class="bu-num">mai sunt {{ leftText() }}</span>
        }
      </div>
    } @else {
      <p class="bu-note"><bu-icon name="target" [size]="14" /> Fără țintă</p>
    }
  `,
})
export class TargetProgress {
  readonly balance = input.required<number>();
  readonly target = input.required<number | null>();
  readonly large = input(false);

  protected readonly percent = computed(() => {
    const target = this.target();
    return target ? (this.balance() / target) * 100 : 0;
  });
  protected readonly clamped = computed(() => Math.max(0, Math.min(100, this.percent())));
  protected readonly reached = computed(() => this.percent() >= 100);
  protected readonly percentText = computed(() => formatPercent(this.percent()));
  protected readonly targetText = computed(() => formatEUR(this.target() ?? 0));
  protected readonly leftText = computed(() => formatEUR(Math.max(0, (this.target() ?? 0) - this.balance())));
}
