import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ThemeService } from '../core/theme.service';
import { BudgetStore } from '../data/budget-store';
import { Icon, type IconName } from '../shared/icon';
import { ToastHost } from '../shared/toast';
import { ShellService } from './shell.service';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/sumar', label: 'Sumar', icon: 'sumar' },
  { path: '/fonduri', label: 'Fonduri', icon: 'vault' },
  { path: '/investitii', label: 'Investiții', icon: 'chart' },
  { path: '/istoric', label: 'Istoric', icon: 'history' },
  { path: '/setari', label: 'Setări', icon: 'settings' },
];

/** App chrome: header + tab bar on mobile, sidebar + top bar from 960px. Pages render inside. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgTemplateOutlet, Icon, ToastHost],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly store = inject(BudgetStore);
  protected readonly shell = inject(ShellService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly nav = NAV_ITEMS;

  protected readonly email = computed(() => this.auth.user()?.email ?? '');
  protected readonly displayName = computed(() => this.store.profile()?.displayName ?? '');
  protected readonly initials = computed(() =>
    this.displayName()
      .split(/\s*&\s*/)
      .map((part) => part.trim().charAt(0).toUpperCase())
      .filter(Boolean)
      .slice(0, 2),
  );

  constructor() {
    // Instantiated here so the saved theme applies as soon as the profile loads.
    inject(ThemeService);
  }

  protected async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/autentificare');
  }
}
