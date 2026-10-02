# Month selector

The header control that moves between months and shows the selected month's status.

- **Provide**: the month label („Octombrie 2026”, capitalised month as in the rest of the UI), its status, and previous/next handlers.
- Mobile: a band on `surface` under the app header — ‹ month › on the left, status chip on the right. Month in `title-2`.
- Desktop: in the top bar, arrows as bordered icon buttons, month in `title-1`, chip after it.
- Arrows are `size-control-sm` icon buttons with `aria-label` „Luna anterioară” / „Luna următoare”.
