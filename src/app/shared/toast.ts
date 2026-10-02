import { ChangeDetectionStrategy, Component, inject, Injectable, signal } from '@angular/core';

/** One short confirmation at a time („Retragerea a fost adăugată.”), gone after a few seconds. */
@Injectable({ providedIn: 'root' })
export class Toast {
  readonly message = signal<string | null>(null);
  private timer: ReturnType<typeof setTimeout> | null = null;

  show(text: string): void {
    this.message.set(text);
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => this.message.set(null), 3200);
  }
}

@Component({
  selector: 'bu-toast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (toast.message(); as message) {
      <div class="toast body" role="status">{{ message }}</div>
    }
  `,
  styles: `
    .toast {
      position: fixed;
      left: 50%;
      bottom: calc(var(--size-tabbar) + env(safe-area-inset-bottom) + var(--space-4));
      transform: translateX(-50%);
      z-index: 60;
      max-width: calc(100vw - 2 * var(--space-4));
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      background: var(--ink);
      color: var(--bg);
      box-shadow: var(--shadow-lg);
      white-space: nowrap;
    }
    @media (min-width: 960px) {
      .toast {
        left: auto;
        right: var(--space-8);
        bottom: var(--space-8);
        transform: none;
      }
    }
  `,
})
export class ToastHost {
  protected readonly toast = inject(Toast);
}
