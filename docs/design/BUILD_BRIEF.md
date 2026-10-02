# Buget — build brief

Build a personal-finance web app for a couple who share one login. Each month they enter one income, subtract fixed expenses, and split the remainder by percentages into saving buckets (with balances) and spending buckets (monthly allowances). The UI is entirely in Romanian. The currency is always euro.

This brief is the functional spec. The visual spec is the design system in `design/` and the artboards in `artboards/`. Where this brief and the reference code in `design/reference/` disagree, **this brief wins**.

---

## 0. What is in this package

| Path | Use it for |
|---|---|
| `BUILD_BRIEF.md` | This spec: scope, data model, business rules, screens, copy, acceptance tests. |
| `CLAUDE.md` | Short, always-on rules (language, money, colours). Copy it to the repo root. |
| `design/design-system.md` | The brand book: content rules, colour/type/spacing/layout/state rules. |
| `design/tokens.css` | Ready-to-import CSS variables (light, dark, automatic) plus one class per type style. |
| `design/tokens.json` | Source of the tokens, with a usage note on each. |
| `design/components/*.md` | Guidelines per component (button, amount, chip, month selector, allocation meter, …). |
| `design/reference/bundle.css` | Reference styles for every component (`bu-` prefix). Port them; class names are a guide. |
| `design/reference/bundle.js` | Reference only: money formatting, icon SVG paths (`I` map), and the HTML of every artboard. Do **not** ship it; it builds HTML strings and its `calc()` is simplified. |
| `design/seed.json` | Example data behind every artboard (integer cents). Use it to seed dev/test. |
| `design/expected-octombrie-2026.json` | The exact numbers October 2026 must produce from the seed. Use in unit/E2E tests. |
| `artboards/*.png` | Every screen × mobile (390 px, @2x) / desktop (1280 px) × light / dark. |
| `prototype/buget-machete.html` | Offline viewer of all artboards (open in a browser). Static mockups, not interactive. |

Read in this order: this brief → `design/design-system.md` → the artboards for the screen you are building → `design/tokens.css`.

---

## 1. Decisions to confirm with the owner

Use the default unless the owner says otherwise. Ask before deviating.

| # | Question | Default |
|---|---|---|
| D1 | Stack | React + TypeScript + Vite SPA, React Router, Supabase (Postgres, email/password Auth, Row Level Security). If the repo already has a stack, use that. |
| D2 | Where a new month's fixed expenses come from | Copy the **previous month's** list; if there is no previous month, copy the **template** from Setări. Editing the template affects months created afterwards only when they have no predecessor. *(The brief said both "prefilled from the previous month" and "fixed expense template"; this default honours both. The owner may prefer "always from the template".)* |
| D3 | Editing a percentage in Sumar | Changes that month only. Setări holds the default percentages that new months start from. |
| D4 | Withdrawal larger than the balance | Blocked with an error. |
| D5 | Sign-up | No public sign-up. One account is created once (seed script or Supabase dashboard). |
| D6 | Percentage precision | Up to one decimal (e.g. `2,5%`). |

---

## 2. Scope

**In v1**: Autentificare, Sumar (current or any month; Planificată / Aplicată), Fonduri, bucket detail with withdrawals, Istoric, Setări (default income, fixed-expense template, categories, theme), light/dark/automatic theme, mobile and desktop layouts.

**Not in v1**: bank sync, multiple currencies, multiple households or users, tracking individual purchases inside spending buckets, charts, notifications, export.

---

## 3. Data model

All money is stored as **integer euro cents**. Percentages are stored as tenths of a percent (`200` = 20,0%) or as `numeric(4,1)`. Every row belongs to the single account (`user_id`, RLS `user_id = auth.uid()`).

```
profile               user_id PK, display_name ("Silviu & Baby"), default_income_cents, theme ('auto'|'light'|'dark')
fixed_expense_template id, user_id, name, amount_cents, position
categories            id, user_id, name, kind ('saving'|'spending'), percent, target_cents NULL,
                      overflow_to_id NULL → categories.id, initial_balance_cents DEFAULT 0, created_on date,
                      position, archived_at NULL
months                id, user_id, year, month (1–12), income_cents, status ('planned'|'applied'), applied_at NULL
                      UNIQUE (user_id, year, month)
month_fixed_expenses  id, month_id, name, amount_cents, position
month_allocations     id, month_id, category_id, percent,
                      -- written by "Aplică luna", so an applied month shows exactly what was posted:
                      share_cents NULL, kept_cents NULL, surplus_out_cents NULL, surplus_in_cents NULL, balance_after_cents NULL
movements             id, user_id, category_id, type ('contribution'|'withdrawal'), amount_cents (+ / −),
                      occurred_on date, note, month_id NULL (set for contributions), created_at
```

- Balance of a saving category = `initial_balance_cents + Σ movements.amount_cents`.
- Spending categories have no balance and never get movements.
- `initial_balance_cents` and `target_cents` are only meaningful for `saving`.

Seed: `design/seed.json` (same shape, camelCase). Today in the designs is 2026-10-02, time zone Europe/Bucharest.

---

## 4. Business rules (authoritative)

### 4.1 A month

- **Rămas de împărțit** `R = income − Σ fixed expenses` (may be negative).
- **Current month** = calendar month in Europe/Bucharest. If it does not exist when Sumar opens, create it as `planned`: income = `profile.default_income_cents`, fixed expenses per D2, allocations = every non-archived category with its default percent.
- The month selector moves one month back or forward. Moving forward to a month that does not exist creates it (as above), but never further than **current month + 1**. Back stops at the first month (arrow disabled).
- New categories are added to existing **planned** months with `0%`. Archived categories are removed from planned months. Applied months never change.

### 4.2 Shares

- `P = Σ percent` of the month's allocations. The month can be applied only when **P = 100,0% exactly and R ≥ 0**.
- Share of category i: `R × pᵢ / 100`, rounded to cents with the **largest-remainder method** (floor every share, give the leftover cents one by one to the largest fractional parts, ties by `position`), so that Σ shares = R exactly when P = 100%.
- While P ≠ 100%, show floored shares; the allocation meter shows `Nealocat: x% · y €` (P < 100) or `Peste 100% cu x% · −y €` in `negative` (P > 100).

### 4.3 Targets and overflow ("Surplusul merge către …")

For each saving category, `balanceBefore` = its current balance (before this month).

1. Every saving category starts with `incoming = own share`.
2. A category with **both** a target and an overflow destination keeps at most `room = max(0, target − balanceBefore)`. The excess moves to `overflow_to`.
3. Process in `position` order and follow chains: the destination applies the same rule to everything that arrives (its own share plus the excess). A dead end (no destination, destination archived or spending) or a cycle keeps the excess in the last category reached.
4. A category with a target but **no** overflow destination keeps everything (the target is informational and the bar can pass 100%).
5. Record per category: `share` (own), `kept` (posted to this category), `surplus_out` (from its own share, sent on), `surplus_in` (received from others), `balance_after = balanceBefore + kept`.

Example from the seed (must match `expected-octombrie-2026.json`): R = 7.000,00 €. Fond de siguranță: share 1.400,00 €, sold 17.200,00 €, țintă 18.000,00 € → keeps 800,00 €, sends 600,00 € to Investiții. Investiții: share 2.800,00 € + 600,00 € received → posts 3.400,00 €, sold după lună 42.400,00 €. Total posted to savings: 5.600,00 €.

### 4.4 Aplică luna / Editează

- **Aplică luna** opens a confirm dialog, then in **one transaction**: re-validates (P = 100%, R ≥ 0, status planned), computes 4.2–4.3, writes the results into `month_allocations`, inserts one `contribution` movement per saving category with `kept > 0` (date = today, note = month label, e.g. „Octombrie 2026”, `month_id` set), sets `status = applied`, `applied_at = now`.
- An applied month is read-only: inputs become text, the banner shows the date and time, „Editează” is available.
- **Editează** (on an applied month) opens a confirm dialog, then in one transaction deletes that month's contribution movements, clears the stored results, and sets `status = planned`. Re-applying posts again with current balances.
- Months may be applied in any order; balances always come from movements.

### 4.5 Withdrawals

- Only on saving categories, from the bucket detail form „Adaugă retragere”: Sumă (required, > 0, ≤ current balance), Notă (optional, ≤ 120 characters). Date = today. Stored as a negative movement.
- The form shows a live preview: `Retragere −350,00 €` and `Sold după retragere`.
- Withdrawals are allowed whatever the status of any month.

### 4.6 Categories (Setări)

- Fields: Nume (required, unique), Tip (Fond de economii / Buget de cheltuieli), Procent, Țintă (optional, > 0, saving only), Surplusul merge către (optional, another non-archived saving category, never itself), Sold inițial (saving only, ≥ 0).
- Changing Tip from saving to spending is blocked while the balance ≠ 0 or movements exist.
- **Delete**: confirm dialog. With movements → archive (history stays visible in Istoric mișcări); without → hard delete. Any `overflow_to` pointing at it is cleared.
- **Reorder**: drag handle plus „Mută sus” / „Mută jos” buttons (keyboard accessible). Order drives every list.
- The Setări card shows the default-percent total with the same 100% indicator; saving is allowed when the total ≠ 100%, but the indicator stays visible.

### 4.7 Saving behaviour

Sumar and Setări lists save **on blur or Enter** (optimistic, revert on error); there is no global save on Sumar. Forms with explicit buttons (row editors, category editor, Venit implicit, withdrawal) save only on Salvează / Adaugă.

---

## 5. Formatting and input

- **Money**: `1.400,00 €` — `.` thousands from 1.000 up, `,` decimals, always 2 decimals, U+00A0 before `€`. Negative: true minus U+2212 (`−600,00 €`). Contributions shown with `+`. Do not rely on `Intl.NumberFormat('ro-RO')` (it prints `1400,00 €`). Reference: `eur()` and `num()` in `design/reference/bundle.js`.
- **Percent**: `20%`, `95,6%`. **Dates**: `02.09.2026`. **Date-time**: `02.10.2026 la 09:14`. **Months**: capitalised, `Octombrie 2026` (Ianuarie … Decembrie).
- **Money input** (`inputmode="decimal"`, suffix `€` shown as a muted adornment): if the text contains `,` then `.` is a thousands separator and `,` the decimal; otherwise a final `.` followed by 1–2 digits is a decimal point, and any other `.` is a thousands separator. Reformat on blur (`1400.5` → `1.400,50`). Reject letters and more than 2 decimals.
- **Percent input**: 0–100, one decimal, `,` or `.` accepted, suffix `%`.
- Amounts always use tabular figures (`font-variant-numeric: tabular-nums`).
- **Colour**: `positive` only for money in (contributions, R ≥ 0), `negative` only for money out (withdrawals, R < 0, over-allocation). Everything else is `ink`. Every coloured amount also carries a sign or a label.

---

## 6. Screens

Routes: `/autentificare`, `/sumar` (current month), `/sumar/:yyyy-mm`, `/fonduri`, `/fonduri/:categoryId`, `/istoric`, `/setari`. `/` redirects to `/sumar`. Every route except `/autentificare` requires a session.

**Shell.** Mobile (< 960 px): header 56 px with „Buget” and „Deconectare”, bottom tab bar 64 px (+ safe-area inset) with Sumar, Fonduri, Istoric, Setări. Desktop (≥ 960 px): 240 px sidebar (wordmark, the 4 destinations, account name and email at the bottom), 64 px top bar (page title or month selector left, „Deconectare” right), content max 1040 px. „Deconectare” signs out immediately, with no confirm.

| Screen | Artboards | Notes |
|---|---|---|
| Autentificare | `01-autentificare_*` | Email, Parolă (with a show/hide eye button), „Autentificare” (full width), footnote „Un singur cont pentru amândoi.” Errors inline under the button. Mobile: centred on `bg`; desktop: card centred, `radius-xl`, `shadow-lg`. |
| Sumar · Planificată | `02-sumar-planificata_*` | Month selector + status chip. **Venit lunar** (large input, caption „Implicit: …”). **Cheltuieli fixe**: list with Total; mobile = tap a row to open the inline editor (Nume, Sumă, Șterge / Anulează / Salvează); desktop = amount inputs inline plus pencil (rename) and trash; „Adaugă” in the header opens an empty editor row. **Rămas de împărțit** (green, or red with − when negative, plus the formula line). **Alocări**: allocation meter, groups „Fonduri de economii” / „Bugete de cheltuieli” with their % and sum, rows = kind icon, name, percent input, share, „Sold după lună” for saving rows, overflow notes, Total row. **Aplică luna**: sticky bar above the tab bar on mobile, card footer on desktop; disabled unless P = 100% and R ≥ 0, with the reason shown under the meter. |
| Sumar · Aplicată | `03-sumar-aplicata_*` | Chip „Aplicată”, banner on `accent-soft` („Luna a fost aplicată” · date and time · „Editează”), every value read-only, „Sold” = stored `balance_after`. |
| Fonduri | `04-fonduri_*` | KPIs (desktop): Total în fonduri, Contribuții planificate (current month, only while it is planned; hide the tile once it is applied), Retrageri în anul curent. Saving cards: name, Sold, target bar and „x% din …” / „mai sunt …”, or „Fără țintă”; footer: this month's posted or planned contribution and the overflow notes. Cards open the detail. Spending: allowances for the current month („10% din rămas · fără sold”). |
| Detaliu fond | `05-detaliu-fond-de-siguranta_*` | Name, „Fond de economii · x% din rămas”, Sold (hero), target bar, an explanatory note when this month reaches the target. „Adaugă retragere” form (4.5). „Setări fond” summary with „Editează” → Setări with that category's editor open. „Istoric mișcări”: the planned contribution on top (muted, while the month is planned), then movements newest first, then the „Sold inițial” row dated `created_on`. Columns: Dată, Tip (chip), Sumă, Notă. |
| Istoric | `07-istoric_*` | Months newest first: Lună, Venit, Cheltuieli, Rămas, Stare chip; the current month is tagged „luna curentă”. Row → `/sumar/:yyyy-mm`. Desktop KPIs and a Total row over **applied** months of the current year. |
| Setări | `06-setari_*` | Venit implicit (+ Salvează); Temă (Automată / Luminoasă / Întunecată); Șablon cheltuieli fixe (drag, edit, delete, Adaugă, Total); Categorii (list + inline editor per 4.6, Adaugă, Total procente indicator). |

**Theme.** `data-theme="light" | "dark"` on `<html>`; no attribute = Automată (follows `prefers-color-scheme`, already handled in `tokens.css`). Store the choice in `profile.theme` and cache it in `localStorage` to avoid a flash on load.

---

## 7. Copy deck (exact Romanian strings)

Everything visible in the artboards is final copy; reuse it verbatim. Fixed vocabulary: Salvează, Anulează, Adaugă, Editează, Șterge, Confirmă, Total, Sumă, Procent, Lună, Sold, Țintă, Contribuție, Retragere, Istoric, Setări, Deconectare. Diacritics: comma-below ș ț (never ş ţ).

Strings for states that have no artboard:

| Where | Text |
|---|---|
| Login, wrong credentials | Email sau parolă greșită. |
| Login, empty email / password | Introdu adresa de email. / Introdu parola. |
| Any network error | Nu ne-am putut conecta. Încearcă din nou. |
| Required name | Numele este obligatoriu. |
| Amount ≤ 0 | Suma trebuie să fie mai mare decât 0. |
| Withdrawal > balance | Suma depășește soldul fondului (17.200,00 €). |
| Percent total ≠ 100 (under the meter, Aplică disabled) | Procentele trebuie să totalizeze 100%. |
| R < 0 (under Rămas, Aplică disabled) | Cheltuielile fixe depășesc venitul cu 250,00 €. |
| Overflow to itself | Alege alt fond decât acesta. |
| Confirm apply · title / body | Aplici luna Octombrie 2026? / Se adaugă +5.600,00 € în 8 fonduri, iar luna devine doar pentru citire. O poți edita oricând. — buttons: Anulează · Confirmă |
| Confirm reopen · title / body | Editezi luna Octombrie 2026? / Contribuțiile de +5.600,00 € vor fi scoase din fonduri până când aplici luna din nou. — buttons: Anulează · Confirmă |
| Confirm delete category · title / body | Ștergi categoria „Casă”? / Soldul de 1.240,00 € și mișcările rămân în istoric, dar categoria nu mai primește alocări. — buttons: Anulează · Șterge |
| Withdrawal added (toast) | Retragerea a fost adăugată. |
| Settings saved (toast) | Modificările au fost salvate. |
| Istoric, no months | Încă nu există nicio lună. Prima lună se creează automat în Sumar. |
| Fonduri, no saving categories | Nu ai încă fonduri de economii. Adaugă-le din Setări. |
| Bucket detail, no movements | Nicio mișcare încă. |
| Spending row caption | Buget lunar, fără sold |

Amounts and months inside these strings are interpolated with the formatters from §5.

---

## 8. Design implementation notes

- Import `design/tokens.css` globally; reference colours **only** via the CSS variables (`var(--accent)`, …). Never hard-code hex values.
- Self-host Inter (e.g. `@fontsource/inter` 400/500/600/700, including the latin-ext subset for ă â î ș ț); the fallback stack is in `--font-sans`.
- Port `design/reference/bundle.css` into your component styles. Keep the measurements (heights 44/36 px, radii, paddings) exact.
- Icons: build an `<Icon name size>` component from the SVG path strings in the `I` map of `design/reference/bundle.js` (24×24 viewBox, stroke 1.75, round caps and joins, `currentColor`). Sizes: 22 tab bar, 20 navigation, 16–18 buttons and rows, 14 notes and chips.
- Green and red never appear on anything but amounts (not on progress bars, chips, icons or the Șterge button).
- Accessibility: visible `focus-ring` on every interactive element; icon-only buttons have `aria-label` (e.g. „Luna anterioară”, „Luna următoare”, „Editează Chirie”, „Mută sus”); the meter and target bars are `role="progressbar"` with values; dialogs trap focus and close on Escape; the tab bar and sidebar use `aria-current="page"`. Touch targets ≥ 44 px.

---

## 9. Acceptance criteria

Unit tests (Vitest or equivalent):

- `formatEUR`: `140000 → "1.400,00 €"`, `-60000 → "−600,00 €"`, `80000 with sign → "+800,00 €"`, `6842000 → "68.420,00 €"`, `0 → "0,00 €"`, `99 → "0,99 €"`, `100000000 → "1.000.000,00 €"` (each with U+00A0 before €).
- `parseMoney`: `"1.400,50" → 140050`, `"1400,5" → 140050`, `"1400.50" → 140050`, `"1.400" → 140000`, `"abc" → error`, `"1,234" → error` (3 decimals).
- `formatPercent`: `95.555 → "95,6%"`, `20 → "20%"`.
- Allocation over the seed reproduces **every** field of `design/expected-octombrie-2026.json`.
- Overflow edge cases: destination also full (excess continues along the chain); cycle A→B→A (excess stays); target already exceeded (room 0, the whole share moves); no destination (keeps everything); rounding (R = 1.000,01 € split 33,3 / 33,3 / 33,4 sums to exactly R).

End-to-end (Playwright), on the seed:

1. Log in → Sumar shows Octombrie 2026, Planificată, 10.000,00 / 3.000,00 / 7.000,00 €, meter 100%.
2. Set Vacanțe to 5% → meter shows „Nealocat: 5% · 350,00 €”, Aplică luna is disabled; set it back to 10%.
3. Aplică luna → Confirmă → chip Aplicată; Fonduri shows Fond de siguranță 18.000,00 €, Investiții 42.400,00 €, total 74.020,00 €.
4. Editează → Confirmă → balances return to 17.200,00 € / 39.000,00 €.
5. Fond de siguranță → withdraw 350,00 € „Revizie anuală centrală” → Sold 16.850,00 €; withdrawing 20.000,00 € shows the balance error.
6. Theme Întunecată persists after reload; viewports 390 px and 1280 px match the artboards' layout.

---

## 10. Suggested build order

1. Scaffold, `tokens.css`, Inter, theme switching, app shell (header, tab bar, sidebar) responsive.
2. Domain library: money and percent format/parse, allocation and overflow, with the unit tests above.
3. Database schema, RLS, seed from `design/seed.json`.
4. Autentificare.
5. Sumar: planned editing → Aplică luna → applied → Editează.
6. Fonduri, bucket detail, withdrawals.
7. Istoric.
8. Setări.
9. Empty and error states, accessibility pass, E2E tests, visual check against the artboards in both themes.
