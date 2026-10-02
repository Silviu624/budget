import { computed, Injectable, signal } from '@angular/core';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { auth } from './firebase';

@Injectable({ providedIn: 'root' })
export class AuthService {
  /** `undefined` until Firebase has restored the session, afterwards the user or `null`. */
  private readonly userState = signal<User | null | undefined>(undefined);

  readonly user = this.userState.asReadonly();
  readonly isLoggedIn = computed(() => !!this.userState());

  /** Resolves once Firebase has reported the initial auth state (restored session or none). */
  readonly ready: Promise<void>;

  constructor() {
    this.ready = new Promise<void>((resolve) => {
      onAuthStateChanged(auth, (user) => {
        this.userState.set(user);
        resolve();
      });
    });
  }

  async login(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async logout(): Promise<void> {
    await signOut(auth);
  }
}
