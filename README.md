# Budget

A small web app for tracking household money: how much comes in each month and how it gets
distributed. Two people share one account and see the same data.

Everything runs on free tiers, with no credit card required:

| Piece      | Service                            | Why                                                            |
| ---------- | ---------------------------------- | -------------------------------------------------------------- |
| Frontend   | Angular 21 (standalone, zoneless)  | Static single-page app, no server to pay for                   |
| Login      | Firebase Authentication            | Email + password, one shared household account                 |
| Database   | Cloud Firestore (Firebase)         | Free Spark plan, never pauses, generous limits for 2 users     |
| Hosting    | GitHub Pages                       | Free for public repos, deployed automatically by GitHub Actions |

Live site (after the first deploy): https://silviu624.github.io/budget/

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
> the deploy workflow uses `npm install` instead of the stricter `npm ci`.

## One-time Firebase setup

1. Go to https://console.firebase.google.com and **Add project** (name it `budget` or similar).
   Google Analytics can be turned off. Stay on the free **Spark** plan.
2. **Authentication** → Get started → Sign-in method → enable **Email/Password**.
3. **Authentication** → Users → **Add user**: this is the shared household account. Choose the
   email and password you will both use.
4. **Authentication** → Settings → **User actions** → untick **Enable create (sign-up)** so
   nobody else can register an account.
5. **Firestore Database** → Create database → start in **production mode**, pick a region close
   to you (for example `europe-west`).
6. **Firestore Database** → Rules → paste the contents of [firestore.rules](firestore.rules),
   replacing `you@example.com` with the household email from step 3 → **Publish**.
   Only the console copy needs the real email; keep the placeholder in this public repo.
   (Alternatively, with the Firebase CLI: `firebase login`, `firebase use <project-id>`,
   `firebase deploy --only firestore:rules`.)
7. **Project settings** (gear icon) → General → Your apps → **Add app** → Web (`</>`).
   Register it (no hosting needed) and copy the `firebaseConfig` values into
   [src/environments/environment.ts](src/environments/environment.ts).
8. **Authentication** → Settings → **Authorized domains** → add `silviu624.github.io`.

The values in `environment.ts` are safe to commit: they only identify the project, and access is
controlled by Authentication plus the Firestore rules. Optional hardening: in Google Cloud
console → APIs & Services → Credentials, restrict the browser API key to the
`silviu624.github.io/*` and `localhost` referrers.

## Deployment

Every push to `main` runs [.github/workflows/deploy.yml](.github/workflows/deploy.yml), which
runs the tests, builds the app with `--base-href /budget/` and publishes `dist/budget/browser`
to GitHub Pages. `index.html` is also copied to `404.html` so deep links such as `/budget/login`
load the app instead of a GitHub 404 page.

GitHub Pages must be set to deploy from **GitHub Actions**
(repository Settings → Pages → Source).

## Project layout

```
src/app/core/firebase.ts        Firebase app, Auth and Firestore instances
src/app/core/auth.service.ts    Login / logout, current user as a signal
src/app/core/auth.guard.ts      Route guards (authGuard, guestGuard)
src/app/pages/login/            Sign-in page
src/app/pages/dashboard/        Signed-in home page (features go here)
src/environments/environment.ts Firebase web config
firestore.rules                 Database access rules
```
