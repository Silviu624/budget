# Amount

How every euro value is written and coloured: Romanian grouping, comma decimals, a no-break space before €, tabular figures.

- Format: `1.400,00 €` — `.` thousands separator from 1.000 up (do not rely on `Intl.NumberFormat('ro-RO')`, which prints `1400,00 €`), `,` decimals, always two decimals, U+00A0 before `€`. Use `Buget.eur(n)`.
- Signs: negative values use the true minus U+2212 (`−600,00 €`); contributions use `+` (`Buget.eur(n, {sign: true})`).
- Colour: `positive` only for money coming in (contributions, a remainder ≥ 0), `negative` only for money going out (withdrawals, a remainder < 0, over-allocation). Everything else — allocations, balances, fixed expenses, income — is `ink`.
- The sign and the row label always carry the meaning too, so the amount reads correctly without colour.
- Always `font-variant-numeric: tabular-nums` (class `bu-num`) so columns of amounts align.
- Percentages: `20%`, one decimal when needed with a comma: `95,6%`.
