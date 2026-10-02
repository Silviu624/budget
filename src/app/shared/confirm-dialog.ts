import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  viewChild,
} from '@angular/core';

let nextId = 0;

/** Asks before an action that changes balances or removes data. Bottom sheet on mobile, centred dialog on desktop. */
@Component({
  selector: 'bu-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bu-scrim" (click)="onScrim($event)">
      <div
        class="bu-dialog"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="id + '-title'"
        [attr.aria-describedby]="id + '-body'"
        (keydown)="onKeydown($event)"
      >
        <h2 class="title-2" [id]="id + '-title'">{{ title() }}</h2>
        <p class="bu-muted" [id]="id + '-body'">{{ body() }}</p>
        <div class="acts">
          <button #first type="button" class="bu-btn secondary" (click)="cancelled.emit()">Anulează</button>
          <button #last type="button" class="bu-btn primary" [disabled]="busy()" (click)="confirmed.emit()">
            {{ confirmLabel() }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ConfirmDialog implements OnDestroy {
  readonly title = input.required<string>();
  readonly body = input.required<string>();
  readonly confirmLabel = input('Confirmă');
  readonly busy = input(false);
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  protected readonly id = `bu-dialog-${nextId++}`;
  private readonly first = viewChild.required<ElementRef<HTMLButtonElement>>('first');
  private readonly last = viewChild.required<ElementRef<HTMLButtonElement>>('last');
  private readonly previouslyFocused = document.activeElement as HTMLElement | null;

  constructor() {
    afterNextRender(() => this.last().nativeElement.focus());
  }

  ngOnDestroy(): void {
    this.previouslyFocused?.focus?.();
  }

  protected onScrim(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cancelled.emit();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelled.emit();
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    const first = this.first().nativeElement;
    const last = this.last().nativeElement;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
