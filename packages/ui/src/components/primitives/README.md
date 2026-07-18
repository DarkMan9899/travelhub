# primitives

**Sprint 2 status:** `Button` implemented.
**Sprint 3 status:** `Badge`, `Avatar`, `Tooltip` implemented. `Tag`,
`Icon` (COMPONENT_LIBRARY.md Part II Section 1) remain scaffolded, not
implemented — out of scope so far.

Each component, when implemented, follows the full specification in
`COMPONENT_LIBRARY.md` (Purpose, Props, States, Variants, Accessibility,
Animation, Responsive Behaviour, Dependencies, Where it is used) exactly
— one file per component, colocated with its `.module.scss`
(`FRONTEND_ARCHITECTURE.md` Section 9.1) and its own tests
(`FRONTEND_ARCHITECTURE.md` Section 35).

## Button

```jsx
import { Button } from '@travelhub/ui/components/primitives';

<Button variant="primary" size="md" onClick={handleBook}>
  Book now
</Button>

<Button variant="destructive" loading>
  Cancelling…
</Button>

<Button ariaLabel="Add to favorites" iconLeft={<HeartIcon aria-hidden="true" />} />
```

`variant`: `primary` / `secondary` / `ghost` / `destructive`.
`size`: `sm` / `md` / `lg`. See `Button.jsx` for the full prop list —
`disabled`, `loading`, `iconLeft`/`iconRight`, `fullWidth`, `type`,
`onClick`, `ariaLabel` (required for icon-only usage, since the button
then has no visible text to derive an accessible name from).

Icon-only buttons (no `children`) automatically pad up to the 44×44px
minimum touch target regardless of the visual icon size.

## Badge

```jsx
import { Badge } from '@travelhub/ui/components/primitives';

<Badge variant="success" label="Confirmed" filled />
<Badge variant="neutral" label="Draft" />
```

`variant`: `success` / `warning` / `danger` / `neutral` / `info`
(`neutral` and `info` reuse the Gray scale and Royal Blue respectively —
see `Badge.jsx`'s file header). `size`: `sm` / `md`. `label` is always
rendered as real text — color is never the only signal.

## Avatar

```jsx
import { Avatar } from '@travelhub/ui/components/primitives';

<Avatar name="Ani Petrosyan" userId={user.id} src={user.avatarUrl} size="lg" />;
```

Shows a `Skeleton` while the image loads, falls back to deterministic-
color initials if `src` is omitted or fails to load. `src` is a plain
URL string in this sprint (no Media-object/Image-primitive layer yet —
see `Avatar.jsx`'s file header).

## Tooltip

```jsx
import { Tooltip } from '@travelhub/ui/components/primitives';

<Tooltip content="Add to favorites" placement="top">
  <button type="button" aria-label="Add to favorites">
    <HeartIcon aria-hidden="true" />
  </button>
</Tooltip>;
```

Wraps a single child trigger; shows on hover **and** keyboard focus,
never on touch-only devices. `placement` auto-flips to the opposite
side when the trigger is near a viewport edge (single-axis check, not a
full collision-detection engine — see `Tooltip.jsx`'s file header).
