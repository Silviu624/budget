import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FirebaseError } from 'firebase/app';
import { AuthService } from '../../core/auth.service';
import { Icon } from '../../shared/icon';

const COPY = {
  emptyEmail: 'Introdu adresa de email.',
  emptyPassword: 'Introdu parola.',
  wrong: 'Email sau parolă greșită.',
  network: 'Nu ne-am putut conecta. Încearcă din nou.',
};

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, Icon],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showPassword = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected async submit(): Promise<void> {
    if (this.busy()) {
      return;
    }
    const { email, password } = this.form.controls;
    if (email.invalid) {
      this.error.set(COPY.emptyEmail);
      return;
    }
    if (password.invalid) {
      this.error.set(COPY.emptyPassword);
      return;
    }

    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.login(email.value.trim(), password.value);
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/sumar';
      await this.router.navigateByUrl(returnUrl);
    } catch (err) {
      this.error.set(describeError(err));
    } finally {
      this.busy.set(false);
    }
  }
}

function describeError(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
      case 'auth/invalid-email':
      case 'auth/user-disabled':
        return COPY.wrong;
      default:
        return COPY.network;
    }
  }
  return COPY.network;
}
