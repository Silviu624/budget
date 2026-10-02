import { Component, inject } from '@angular/core';
import { ShellService } from '../../shell/shell.service';

@Component({
  selector: 'app-fonduri',
  template: '<h1 class="title-1">Fonduri</h1>',
})
export class Fonduri {
  constructor() {
    inject(ShellService).title.set('Fonduri');
  }
}
