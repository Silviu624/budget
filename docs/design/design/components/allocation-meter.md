# Allocation meter

Shows live how much of „Rămas de împărțit” the percentages cover, and gates „Aplică luna”.

- Under 100%: accent fill to the total, text „Nealocat: 5% · 350,00 €”; „Aplică luna” stays disabled.
- Exactly 100%: full accent bar, check icon, „Totul este alocat · nealocat 0,00 €”.
- Over 100%: the bar rescales so 100% sits at a tick; the excess is a `negative` segment and the excess money is shown as a negative amount („−280,00 €”).
- Height 10px, `radius-full`, track `surface-sunken`.
