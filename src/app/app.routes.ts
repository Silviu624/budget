import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'autentificare',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shell/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'sumar' },
      { path: 'sumar', loadComponent: () => import('./pages/sumar/sumar').then((m) => m.Sumar) },
      { path: 'sumar/:key', loadComponent: () => import('./pages/sumar/sumar').then((m) => m.Sumar) },
      { path: 'fonduri', loadComponent: () => import('./pages/fonduri/fonduri').then((m) => m.Fonduri) },
      {
        path: 'fonduri/:id',
        loadComponent: () => import('./pages/fonduri/fond-detaliu').then((m) => m.FondDetaliu),
      },
      { path: 'istoric', loadComponent: () => import('./pages/istoric/istoric').then((m) => m.Istoric) },
      { path: 'setari', loadComponent: () => import('./pages/setari/setari').then((m) => m.Setari) },
    ],
  },
  { path: 'login', redirectTo: 'autentificare' },
  { path: '**', redirectTo: 'sumar' },
];
