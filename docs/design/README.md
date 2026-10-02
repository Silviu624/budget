# Buget — design handoff

Everything needed to build **Buget**, a shared monthly-budget web app for a couple (Romanian UI, euro).

**Start with `BUILD_BRIEF.md`.** Place this folder at `docs/design/` in the code repository and copy `CLAUDE.md` to the repository root so its rules stay active.

```
BUILD_BRIEF.md                      functional spec: scope, data model, rules, screens, copy, tests
CLAUDE.md                           always-on project rules
design/design-system.md             brand book (colour, type, spacing, layout, states, content)
design/tokens.css                   CSS variables for light / dark / automatic + type classes
design/tokens.json                  token source with usage notes
design/components/*.md              component guidelines
design/reference/bundle.css|js      reference styles, formatters, icon paths, artboard markup
design/seed.json                    example data (integer cents) behind every artboard
design/expected-octombrie-2026.json exact results October 2026 must produce
artboards/*.png                     7 screens × mobile/desktop × light/dark, plus 00-tokens.png
prototype/buget-machete.html        offline viewer of every artboard
```

## Cum îl dai lui Claude Code

1. Dezarhivează și pune conținutul folderului în proiect, la `docs/design/` (într-un repository nou sau existent).
2. Copiază `CLAUDE.md` în rădăcina proiectului (dacă există deja unul, adaugă conținutul la final).
3. Scrie-i lui Claude Code: „Citește docs/design/BUILD_BRIEF.md și construiește aplicația Buget pas cu pas, în ordinea din secțiunea 10. Întreabă-mă mai întâi despre deciziile din secțiunea 1.”
