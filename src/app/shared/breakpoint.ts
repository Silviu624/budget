import { Injectable, signal } from '@angular/core';

/** `desktop` is true from 960px (sidebar layout), per the design system. */
@Injectable({ providedIn: 'root' })
export class Breakpoint {
  readonly desktop = signal(false);

  constructor() {
    if (typeof matchMedia === 'undefined') {
      return;
    }
    const query = matchMedia('(min-width: 960px)');
    this.desktop.set(query.matches);
    query.addEventListener('change', (event) => this.desktop.set(event.matches));
  }
}
