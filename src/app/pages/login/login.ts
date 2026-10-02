import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FirebaseError } from 'firebase/app';
import { isFirebaseConfigured } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly configured = isFirebaseConfigured;
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected async submit(): Promise<void> {
    if (this.busy()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.busy.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    try {
      await this.auth.login(email, password);
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/';
      await this.router.navigateByUrl(returnUrl);
    } catch (err) {
      this.error.set(describeError(err));
    } finally {
      this.busy.set(false);
    }
  }
}

function describeError(err: unknown): string {
  if (!(err instanceof FirebaseError)) {
    return 'Login failed.';
  }
  switch (err.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Wrong email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again in a few minutes.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection.';
    case 'auth/invalid-api-key':
      return 'Firebase is not configured yet. See the README.';
    default:
      return `Login failed (${err.code}).`;
  }
}
