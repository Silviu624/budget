import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Lets signed-in users through; everyone else is sent to /login. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  await authService.ready;
  return authService.isLoggedIn()
    ? true
    : router.createUrlTree(['/autentificare'], { queryParams: { returnUrl: state.url } });
};

/** Keeps already signed-in users away from /login. */
export const guestGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  await authService.ready;
  return authService.isLoggedIn() ? router.createUrlTree(['/']) : true;
};
