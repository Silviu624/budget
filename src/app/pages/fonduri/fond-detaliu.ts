import { Component, inject } from '@angular/core';
import { ShellService } from '../../shell/shell.service';

@Component({
  selector: 'app-fond-detaliu',
  template: '',
})
export class FondDetaliu {
  constructor() {
    inject(ShellService).title.set('Fonduri');
  }
}
