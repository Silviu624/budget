import { Component, inject } from '@angular/core';
import { ShellService } from '../../shell/shell.service';

@Component({
  selector: 'app-setari',
  template: '<h1 class="title-1">Setări</h1>',
})
export class Setari {
  constructor() {
    inject(ShellService).title.set('Setări');
  }
}
