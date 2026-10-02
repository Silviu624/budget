import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { AuthService } from '../../core/auth.service';
import { Login } from './login';

describe('Login', () => {
  const authService = {
    user: signal(null),
    isLoggedIn: signal(false),
    ready: Promise.resolve(),
    login: vi.fn(),
    logout: vi.fn(),
  };

  beforeEach(async () => {
    authService.login.mockReset();
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();
  });

  it('renders the sign-in form in Romanian', async () => {
    const fixture = TestBed.createComponent(Login);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('input[type="email"]')).not.toBeNull();
    expect(el.querySelector('input[type="password"]')).not.toBeNull();
    expect(el.querySelector('button[type="submit"]')?.textContent).toContain('Autentificare');
    expect(el.textContent).toContain('Un singur cont pentru amândoi.');
  });

  it('asks for the email before calling login', async () => {
    const fixture = TestBed.createComponent(Login);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(authService.login).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Introdu adresa de email.');
  });

  it('signs in with the entered credentials', async () => {
    authService.login.mockResolvedValue(undefined);
    const fixture = TestBed.createComponent(Login);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    type(el.querySelector('input[type="email"]')!, 'home@example.com');
    type(el.querySelector('input[type="password"]')!, 'secret');
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(authService.login).toHaveBeenCalledWith('home@example.com', 'secret');
  });

  it('toggles the password visibility', async () => {
    const fixture = TestBed.createComponent(Login);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('button.eye') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(el.querySelector('#password')?.getAttribute('type')).toBe('text');
  });
});

function type(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}
