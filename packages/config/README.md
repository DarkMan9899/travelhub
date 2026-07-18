# @travelhub/config

Shared ESLint and Prettier configuration consumed by `apps/web` and
`apps/api`, per `SPRINT_0_IMPLEMENTATION_PLAN.md` Chapters 10–11.

- `eslint-backend.cjs` — base rules for `apps/api`, plus
  `eslint-plugin-boundaries` rules enforcing
  `BACKEND_ARCHITECTURE.md` §3's Clean Architecture dependency direction
  (Domain → Application → Interface Adapters → Infrastructure) as a
  failing lint rule, not a code-review judgment call.
- `eslint-frontend.cjs` — base rules for `apps/web`, plus the same
  `eslint-plugin-boundaries` treatment for
  `FRONTEND_ARCHITECTURE.md` §3.1/§6.3's module and layer dependency
  directions, plus `eslint-plugin-jsx-a11y` at its strict preset
  (`FRONTEND_ARCHITECTURE.md` §30's accessibility floor).
- `prettier-preset.cjs` — the one shared formatting configuration, no
  per-app override.

This package holds tooling configuration only — no business logic, no
components, no runtime application code.
