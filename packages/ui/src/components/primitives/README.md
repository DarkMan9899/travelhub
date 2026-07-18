# primitives

**Sprint 2 status:** `Button` implemented. `Badge`, `Tag`, `Avatar`,
`Tooltip`, `Icon` (COMPONENT_LIBRARY.md Part II Section 1) remain
scaffolded, not implemented — out of this sprint's scope.

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
