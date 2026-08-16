# data-display

**Application Foundation status:** partially implemented — `RatingStars`
and `PriceTag` (read-only display primitives with no business logic).
Table, Chart, Review Card, Accordion remain unimplemented, built by the
sprint that has a real consumer for them.

Each component, when implemented, follows the full specification in
`COMPONENT_LIBRARY.md` (Purpose, Props, States, Variants, Accessibility,
Animation, Responsive Behaviour, Dependencies, Where it is used) exactly
— one file per component, colocated with its `.module.scss`
(`FRONTEND_ARCHITECTURE.md` Section 9.1) and its own tests
(`FRONTEND_ARCHITECTURE.md` Section 35).
