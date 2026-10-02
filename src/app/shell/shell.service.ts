import { Directive, inject, Injectable, OnDestroy, signal, TemplateRef } from '@angular/core';

/** Lets a page hand templates to the app shell: the top band / top bar content and a sticky bottom bar. */
@Injectable({ providedIn: 'root' })
export class ShellService {
  readonly title = signal('');
  readonly topSlot = signal<TemplateRef<unknown> | null>(null);
  readonly bottomSlot = signal<TemplateRef<unknown> | null>(null);
}

@Directive({ selector: 'ng-template[buTopSlot]' })
export class TopSlot implements OnDestroy {
  private readonly shell = inject(ShellService);
  private readonly template = inject(TemplateRef<unknown>);

  constructor() {
    this.shell.topSlot.set(this.template);
  }

  ngOnDestroy(): void {
    if (this.shell.topSlot() === this.template) {
      this.shell.topSlot.set(null);
    }
  }
}

@Directive({ selector: 'ng-template[buBottomSlot]' })
export class BottomSlot implements OnDestroy {
  private readonly shell = inject(ShellService);
  private readonly template = inject(TemplateRef<unknown>);

  constructor() {
    this.shell.bottomSlot.set(this.template);
  }

  ngOnDestroy(): void {
    if (this.shell.bottomSlot() === this.template) {
      this.shell.bottomSlot.set(null);
    }
  }
}
