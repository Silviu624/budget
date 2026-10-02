import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { MonthStatus } from '../domain/types';
import { Icon } from './icon';

/** „Planificată” (hollow dot) or „Aplicată” (accent, check). */
@Component({
  selector: 'bu-status-chip',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="bu-chip" [class.planned]="status() === 'planned'" [class.applied]="status() === 'applied'">
      @if (status() === 'applied') {
        <bu-icon name="check" [size]="14" />
      }
      {{ label() }}
    </span>
  `,
})
export class StatusChip {
  readonly status = input.required<MonthStatus>();
  protected readonly label = computed(() => (this.status() === 'applied' ? 'Aplicată' : 'Planificată'));
}
