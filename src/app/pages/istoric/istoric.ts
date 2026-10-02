import { Component, inject } from '@angular/core';
import { ShellService } from '../../shell/shell.service';

@Component({
  selector: 'app-istoric',
  template: '<h1 class="title-1">Istoric</h1>',
})
export class Istoric {
  constructor() {
    inject(ShellService).title.set('Istoric');
  }
}
