import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { AuthService } from '../../core/auth.service';
import { Dashboard } from './dashboard';

describe('Dashboard', () => {
  const authService = {
    user: signal({ email: 'home@example.com' }),
    isLoggedIn: signal(true),
    ready: Promise.resolve(),
    login: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();
  });

  it('shows the signed-in email', async () => {
    const fixture = TestBed.createComponent(Dashboard);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('home@example.com');
  });

  it('signs out when the button is clicked', async () => {
    const fixture = TestBed.createComponent(Dashboard);
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement).querySelector('button')!.click();
    await fixture.whenStable();
    expect(authService.logout).toHaveBeenCalled();
  });
});
