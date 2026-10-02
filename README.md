# Buget

A shared monthly-budget web app for a couple with one login. Each month you enter one income,
subtract the fixed expenses, and split what remains by percentages into saving buckets (with
balances, targets and overflow), investment buckets (a budget you buy shares from, with the
portfolio and purchases tracked in Investiții) and spending buckets (monthly allowances). The UI is in Romanian,
the currency is euro.

Live site: https://silviu624.github.io/budget/

Everything runs on free tiers, with no credit card required:

| Piece    | Service                                 | Why                                                          |
| -------- | --------------------------------------- | ------------------------------------------------------------ |
| Frontend | Angular 21 (standalone, zoneless)       | Static single-page app, no server to pay for                 |
| Login    | Firebase Authentication                 | Email + password, one shared household account               |
| Database | Cloud Firestore (Firebase)              | Free Spark plan, never pauses, live sync between your phones |
| Hosting  | GitHub Pages                            | Free for public repos, deployed by GitHub Actions on push    |

The functional and visual specification is the design handoff in [docs/design](docs/design/)
(start with [BUILD_BRIEF.md](docs/design/BUILD_BRIEF.md)); the project rules are in
[CLAUDE.md](CLAUDE.md).

## Local development

```bash
npm install
npm start          # http://localhost:4200
npm test           # unit tests (Vitest)
npm run build      # production build into dist/budget/browser
```

Node 24 or newer is required.

> **Note for Windows:** npm on Windows drops a few Linux-only optional packages from
> `package-lock.json` every time you run `npm install`. That is harmless locally, but it is why
> the deploy workflow uses `npm install` instead of the stricter `npm ci`. In Git Bash, build with
> `MSYS_NO_PATHCONV=1 npx ng build --base-href /budget/`, otherwise the base href is rewritten.

## Firebase setup (done once)

1. Create a Firebase project on the free **Spark** plan.
2. **Authentication** → enable **Email/Password**, add the shared household user, and under
   Settings → User actions untick **Enable create (sign-up)**.
3. **Firestore Database** → create the `(default)` database in production mode.
4. **Firestore Database** → Rules → paste [firestore.rules](firestore.rules) with the household
   email in place of `you@example.com` → **Publish**. Only the console copy needs the real email;
   keep the placeholder in this public repo.
5. **Project settings** → Your apps → Web → copy the config into
   [src/environments/environment.ts](src/environments/environment.ts). These values are safe to
   commit: they only identify the project, access is controlled by Authentication and the rules.

On the first sign-in the app writes the default profile, expense template and categories (with
zero balances). Adjust them in **Setări**: starting balances, targets, percentages, names.

## How data is stored

All money is integer euro cents. Firestore collections:

```
settings/profile     display name, default income, theme, fixed-expense template
categories/{id}      name, kind (saving | spending | investment), percent, target, overflow, initial balance, position
months/{yyyy-mm}     income, status (planned | applied), fixed expenses, allocations (+ stored results once applied)
movements/{id}       contributions posted by „Aplică luna”, withdrawals and purchases (symbol, shares,
                     price, fees); a balance = initial + Σ movements
```

The allocation engine (shares with largest-remainder rounding, targets, overflow chains) lives in
[src/app/domain](src/app/domain/) and is covered by unit tests that reproduce
[expected-octombrie-2026.json](docs/design/design/expected-octombrie-2026.json) from the seed.

## Deployment

Every push to `main` runs [.github/workflows/deploy.yml](.github/workflows/deploy.yml): tests,
production build with `--base-href /budget/`, `404.html` fallback for deep links, publish to
GitHub Pages (Settings → Pages → Source: GitHub Actions).

## Project layout

```
src/app/core/        Firebase init, auth service and guards, theme service
src/app/data/        BudgetStore (live Firestore snapshots + every write), default data
src/app/domain/      pure engine: money/percent formatting, dates, allocation, balances, months
src/app/shared/      icon set, money/percent inputs, chips, meters, dialogs, toast
src/app/shell/       app chrome (header, tab bar, sidebar, top bar, page slots)
src/app/pages/       autentificare, sumar, fonduri (+ detaliu), investitii, istoric, setari
src/styles/          design tokens and the component classes ported from the handoff
docs/design/         the Claude Design handoff (spec, design system, artboards, seed)
```
