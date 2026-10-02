# Fields

Text, money, percent and select inputs, plus the segmented control used for „Tip”.

- Label above in `label` / `ink-muted`; optional „Opțional” on the right of the label; hint below in `caption`.
- Input: `surface` fill, 1px `border` (3:1 on every surface), `radius-md`, height `size-control`. Focus: `accent` border + `focus-ring`.
- Money inputs show the Romanian number (`10.000,00`) with a muted `€` suffix; percent inputs a right-aligned number with `%`.
- `lg` (56px, 22px semibold) only for „Venit lunar” on Sumar. `xs` (32px) for the inline percent inputs in the allocation table.
- Segmented control: `surface-sunken` track, selected segment on `surface` with a `line` outline.
