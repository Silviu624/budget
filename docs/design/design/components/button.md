# Button

Buttons for every action: primary for the one main action on a screen, secondary and outline for the rest, text buttons inside cards.

- **Provide**: a label from the fixed vocabulary (Salvează, Anulează, Adaugă, Editează, Șterge, Confirmă, Aplică luna, Autentificare, Deconectare) and optionally an icon from `Buget.icon`.
- `primary` — `accent` fill, `on-accent` label. One per view: „Aplică luna” on Sumar, „Salvează” in a form, „Autentificare”.
- `secondary` — `surface-sunken` fill, `ink` label: „Anulează”.
- `outline` — `surface` fill with a `line` border: „Editează” on an applied month.
- `ghost` — accent text, no fill: „Adaugă” in card headers. `ghost neutral` (ink-muted) for „Șterge” and „Deconectare”.
- Destructive actions are NOT red: red is reserved for negative money. „Șterge” is a neutral text button followed by a confirm dialog.
- Height `size-control` (44px); `sm` is `size-control-sm` (36px). Radius `radius-md` (`radius-sm` when small).
- Focus: `focus-ring`. Disabled: `surface-sunken` fill, `ink-disabled` label („Aplică luna” while the percentages are not 100%).
