# Buget — project rules

Shared monthly-budget web app for a couple (one login). **Stack: Angular 21** (standalone, zoneless,
signals, Vitest) + **Firebase JS SDK 12** (Auth email/password, Firestore), hosted on **GitHub Pages**
via `.github/workflows/deploy.yml` (base href `/budget/`). Node 24. UI in Romanian, code, comments
and commits in English.

The design handoff lives in `docs/design/`. The full spec is `docs/design/BUILD_BRIEF.md`; the visual
spec is `docs/design/design/` and `docs/design/artboards/`. Paths below are relative to `docs/design/`.
Read the brief before starting any feature, and the matching artboards before building a screen.

## Always

- **UI language is Romanian** with correct diacritics: ă â î and comma-below ș ț Ș Ț (U+0219/U+021B/U+0218/U+021A). Never the cedilla forms ş ţ. Reuse the copy from the artboards and BUILD_BRIEF §7 verbatim; the fixed labels are Salvează, Anulează, Adaugă, Editează, Șterge, Confirmă, Total, Sumă, Procent, Lună, Sold, Țintă, Contribuție, Retragere, Istoric, Setări, Deconectare.
- **Money is integer euro cents** end to end. Format with the shared formatter only (`src/app/domain/money.ts`): `1.400,00 €` (thousands `.`, decimals `,`, U+00A0 before €, minus U+2212). Never `Intl.NumberFormat('ro-RO')` on its own.
- **Colours only through the CSS variables** in `design/tokens.css` (imported as `src/styles/tokens.css`). One accent (`--accent`, cobalt). `--positive` / `--negative` (green/red) are for money amounts only, and every coloured amount also has a sign or a label.
- Both themes must work: light, dark and automatic (no `data-theme` attribute = follow the device).
- Mobile first; the desktop layout starts at 960 px (sidebar instead of tab bar).
- Allocation, overflow and apply/reopen logic live in one pure, unit-tested module (`src/app/domain/`), implemented exactly as BUILD_BRIEF §4. The seed must reproduce `design/expected-octombrie-2026.json`.
- `design/reference/bundle.js` is a reference (formatters, icon paths, artboard markup), not production code.
- Run `npx ng test --watch=false` (and E2E tests when they exist) before calling a task done.

## Decisions taken by the owner (2026-10-02)

- **D1 stack**: Angular + Firebase, not React + Supabase. Postgres tables map to Firestore:
  `settings/profile` (profile + fixed-expense template), `categories/{id}`, `months/{yyyy-mm}`
  (with embedded `fixedExpenses` and `allocations`), `movements/{id}`. Row-level security is
  `firestore.rules`; "one transaction" is `runTransaction` / `writeBatch`.
- **D2**: a new month's fixed expenses always come from the **template** in Setări (never the previous month).
- **D3–D6**: defaults from BUILD_BRIEF §1 (per-month percentages, withdrawal > balance blocked, no sign-up, one decimal percent).
- Personal buckets are „Bani personali – Baby” and „Bani personali – Babyshutzu”; the account display name is „Baby & Babyshutzu”.
- The live database starts with the design's categories and expense template but **zero balances**; `design/seed.json` is for tests and local development only.
- **Investiții (2026-10-02)**: a third category kind `investment`, not in the handoff. It behaves like a saving fund plus purchases (movements of type `purchase` with symbol, shares, price, fees; the balance is the „Buget disponibil”). Own page `/investitii` (5th navigation item) built in the design system's style; its copy was written by Claude and approved implicitly by the request.

## Ask the owner before

- Changing any of the decisions above or any default listed in BUILD_BRIEF §1.
- Adding visible text that is not in the artboards or the copy deck.

## Working notes

- Local production build on this Windows machine: `MSYS_NO_PATHCONV=1 npx ng build --base-href /budget/` (Git Bash otherwise rewrites the base href).
- `npm install` on Windows strips two Linux-only optional packages from `package-lock.json`; the deploy workflow therefore uses `npm install`, not `npm ci`. Do not switch it back.
- Firebase project: `budget-afb02`. Config is in `src/environments/environment.ts` (public by design). The household email is only in the console copy of the Firestore rules, not in the repo.
