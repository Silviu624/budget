Buget is a calm, bank-like web app for a couple who share one account. Each month they enter one income, subtract a list of fixed expenses, and split what remains („Rămas de împărțit”) by percentages into saving buckets („Fond de economii”) and spending buckets („Buget de cheltuieli”). Mobile first, with a desktop layout from 960px. Every artboard in this system uses the real example month: Octombrie 2026, venit 10.000,00 €, cheltuieli fixe 3.000,00 €, rămas 7.000,00 €.

## Content fundamentals

- **All UI text is Romanian with correct diacritics.** Use comma-below `ș ț Ș Ț` (U+0219, U+021B, U+0218, U+021A), never the cedilla forms `ş ţ`. Also `ă â î` and their capitals.
- **Voice**: short, plain, friendly; second person singular for instructions („Atinge o lună pentru a o deschide în Sumar”, „Poți edita luna și după”), plural only when addressing the couple as owners („Bugetul vostru lunar, împreună.”). No exclamation marks, no emoji.
- **Casing**: sentence case for headings and buttons („Aplică luna”, „Adaugă retragere”). Month names are capitalised as a product convention: „Octombrie 2026”.
- **Fixed vocabulary — use exactly**: Salvează, Anulează, Adaugă, Editează, Șterge, Confirmă, Total, Sumă, Procent, Lună, Sold, Țintă, Contribuție, Retragere, Istoric, Setări, Deconectare. Product terms: Venit lunar, Cheltuieli fixe, Rămas de împărțit, Alocări, Fond de economii, Buget de cheltuieli, Sold inițial, Surplusul merge către …, Planificată, Aplicată, Aplică luna, Autentificare, Sumar, Fonduri.
- **Money**: `1.400,00 €` — `.` thousands separator from 1.000 up, `,` decimals, always two decimals, a no-break space before `€`. Negative with the true minus `−600,00 €` (U+2212); contributions with `+`. Use `Buget.eur()`; `Intl.NumberFormat('ro-RO')` is not enough because it omits the separator in four-digit numbers.
- **Percent**: `20%`, `95,6%` (comma decimal, no space). **Dates**: `02.09.2026`. **Quotes**: Romanian „…”. Names with a dash use an en dash with spaces: „Bani personali – Silviu”.

## Visual foundations

**Color.** Neutral cool greys and one accent. Pages sit on `bg`; cards, header, sidebar, tab bar and inputs on `surface`; table headers, read-only fields, progress tracks and neutral chips on `surface-sunken`. Text is `ink`; labels, helpers and inactive tabs `ink-muted`. `accent` (cobalt) is the only hue for interaction: the primary button, active navigation (`accent-soft` behind `accent`), links, focus, progress fills and the „Aplicată” chip. Text on an accent fill is `on-accent` (dark in the dark theme, because the accent lightens there).

**Green and red mean money, nothing else.** `positive` only for money coming in (contributions, a remainder ≥ 0); `negative` only for money going out (withdrawals, a remainder < 0, over-allocation). Every coloured amount also carries a sign or a label, so it reads without colour. Progress bars, status chips, destructive buttons („Șterge”) and icons are never green or red.

**Themes.** Two themes, `light` (first, the fallback) and `dark`, switched with `data-theme` on any element; Setări offers Automată / Luminoasă / Întunecată, where Automată follows `prefers-color-scheme`. Every text token is ≥ 4.5:1 on the grounds its note names in both themes; `border` is ≥ 3:1 on `bg`, `surface` and `surface-sunken`.

**Type.** One family, `--font-sans` (Inter, falling back to the system UI face). Amounts always use tabular figures (`font-variant-numeric: tabular-nums`, class `bu-num`). Hero amounts: `display` (desktop bucket balance), `amount-xl` (mobile hero), `amount-lg` (card totals). Titles `title-1` (page), `title-2` (card, section, month), `title-3` (group). Text `body`, `body-strong` (row amounts, button labels), `label` (field labels, table headers, chips), `caption` (helpers, dates), `micro` (tab labels only).

**Space and shape.** 4px base: mobile gutter and card padding `space-4`, desktop card padding `space-5`, gaps between cards `space-6`, desktop page padding `space-8`. Corners: buttons and inputs `radius-md`, cards and tables `radius-lg`, login card and dialogs `radius-xl`, chips and progress bars `radius-full`. Cards are a `surface` fill with a 1px `line` border and `shadow-sm`; only dialogs and menus float with `shadow-lg`.

**Layout.** Mobile (390 artboards): app header (`size-header`) with „Buget” and „Deconectare”, content, bottom tab bar (`size-tabbar`) with Sumar, Fonduri, Istoric, Setări. On Sumar the month selector sits under the header and a sticky bar holds „Aplică luna” above the tabs. Desktop (≥ `breakpoint-desktop`, 1280 artboards): left sidebar (`size-sidebar`) with the wordmark, the four destinations and the couple's account; top bar with the page title or month selector on the left and „Deconectare” on the right; content up to `size-content`, Sumar in two columns (inputs left, allocations right).

**States.** Controls are `size-control` (44px) tall, compact ones `size-control-sm`. Hover and pressed rows use `surface-hover`; keyboard focus is `focus-ring` (2px surface gap, 2px solid accent) on every interactive element; disabled controls use `surface-sunken` with `ink-disabled`. An applied month is read-only: inputs become plain text, a banner on `accent-soft` says when it was applied, and „Editează” reopens it. Motion stays minimal: 150ms ease on hover and colour changes, no decorative animation.

## How the screens behave

- **Month status.** „Planificată” while editing; „Aplică luna” posts the contributions into the saving buckets and the month becomes „Aplicată”. The button stays disabled until the percentages total exactly 100%.
- **Allocation.** Each category's share = Rămas de împărțit × procent. The allocation meter shows the live total and, below 100%, „Nealocat: 5% · 350,00 €”; above 100%, the excess as a negative amount.
- **Overflow.** A saving bucket with a Țintă takes only what it needs to reach it; the rest of its share goes to the bucket named in „Surplusul merge către”. Example: Fond de siguranță (sold 17.200,00 €, țintă 18.000,00 €) receives 800,00 € of its 1.400,00 € share and 600,00 € flows to Investiții.
- **Spending buckets** are monthly allowances with no balance: Cheltuieli extra 700,00 €, Bani personali – Silviu 350,00 €, Bani personali – Baby 350,00 €.
- Fixed expenses are prefilled from the previous month and edited inline; the default income and the fixed-expense template live in Setări, together with the categories (nume, tip, procent, țintă, surplus către, sold inițial — add, edit, delete, reorder).

## Artboards

Each screen card renders the light and the dark theme side by side (mobile) or stacked (desktop): `01 Login`, `02 Summary` (Planificată) and `02 Summary applied` (Aplicată), `03 Funds`, `04 Fund detail` (Fond de siguranță), `05 Settings`, `06 History`, each as mobile and desktop. `00 Tokens` lists every color in both themes, the type scale, spacing, radii, shadows, sizes and ready-to-paste CSS variables. The `Componente` cards document the building blocks one by one.

## Iconography

A small set of 24px line icons drawn for Buget (1.75 stroke, round caps and joins, `currentColor`), available as `Buget.icon(name, size)` and shown on the Icons card. Sizes: 22 in the tab bar, 20 in navigation, 16–18 in buttons and rows, 14 in notes and chips. The kind icons are fixed: `vault` = Fond de economii on `accent-soft`, `wallet` = Buget de cheltuieli on `surface-sunken`. There is no logo yet: the wordmark is the word „Buget” set in `--font-sans` at 700 with −0.02em tracking.

## Using it in code

Load `tokens.css` (the CSS variables and one class per type style), then `components/bundle.css` (component classes, all prefixed `bu-`). Put `data-theme="light"` or `"dark"` on the root, or leave it off to follow the device. `components/bundle.js` defines `window.Buget`: the example data, `calc()` for the allocation and overflow math, `eur()` / `pct()` formatters, `icon()`, small HTML builders under `Buget.ui`, and the screen renderers the artboards use.
