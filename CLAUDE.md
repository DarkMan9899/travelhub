# CLAUDE.md

# TravelHub Engineering Rules

## Mission

You are building a production-ready international travel marketplace.

Quality target:

- Booking.com
- Airbnb
- Expedia
- Stripe
- Apple

Every decision must prioritize:

- Maintainability
- Scalability
- Performance
- Security
- Accessibility
- Developer Experience

Never optimize for speed over quality.

---

# Development Principles

Always follow:

- SOLID
- DRY
- KISS
- YAGNI
- Clean Architecture
- Feature-Based Architecture
- Separation of Concerns
- Composition over Inheritance

---

# General Rules

Before writing code:

1. Analyze the repository.
2. Understand existing architecture.
3. Reuse existing code.
4. Never duplicate functionality.

Never:

- invent architecture
- ignore existing patterns
- create temporary hacks
- leave TODO comments
- leave dead code
- use magic numbers
- hardcode colors
- hardcode spacing
- hardcode typography

---

# Design System

Always use existing design tokens.

Never hardcode:

- colors
- spacing
- radius
- shadows
- typography
- breakpoints

All UI must:

- Responsive
- Accessible
- Keyboard friendly
- WCAG AA
- Mobile First

---

# Frontend Rules

React Best Practices.

Components must be:

- reusable
- composable
- testable
- isolated

Keep components small.

Prefer custom hooks over duplicated logic.

Never place business logic inside UI components.

---

# Backend Rules

Controllers:

- request
- response

Nothing else.

Business logic belongs only inside Services.

Database access belongs only inside Repositories.

Always validate input.

Never trust client data.

Always use transactions when needed.

---

# Database Rules

Never write raw SQL without parameterization.

Never duplicate queries.

Use indexes correctly.

Normalize before optimizing.

---

# Security

Always think about:

- SQL Injection
- XSS
- CSRF
- Authentication
- Authorization
- Rate Limiting
- Input Validation

Security has priority over convenience.

---

# Performance

Always prefer:

- lazy loading
- pagination
- code splitting
- caching
- memoization only when necessary

Avoid unnecessary renders.

Avoid unnecessary database queries.

---

# Git Rules

Never:

- commit
- push
- merge
- delete files

unless explicitly instructed.

Keep changes limited to the current Sprint.

---

# Sprint Workflow

Every Sprint must follow:

1. Analyze
2. Plan
3. Implement
4. Test
5. Self Review
6. Stop

Never continue to another Sprint automatically.

---

# Before Every Change

First explain:

- what will change
- why
- affected files

Wait if clarification is required.

---

# Testing

Every implementation must:

- pass lint
- pass tests
- compile successfully

If tests are missing,
create them.

---

# Code Quality

Every new code must be:

- readable
- maintainable
- scalable
- documented

Prefer clarity over cleverness.

---

# Definition of Done

A task is finished only if:

✓ Build succeeds

✓ Tests pass

✓ Lint passes

✓ No duplicated code

✓ No dead code

✓ No TODO

✓ No console.log

✓ Documentation updated

✓ Ready for production review

---

# Communication

When responding:

1. Explain the plan.
2. Implement only requested scope.
3. Mention assumptions.
4. Mention risks.
5. Stop after finishing the Sprint.

Never continue automatically.

Quality is more important than speed.
