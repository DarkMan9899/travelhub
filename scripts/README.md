# scripts/

Operational scripts that don't belong inside a single app/package.

**Sprint 1 status:** empty. Every Sprint 1 developer-experience need
(install, lint, build, test, docker up/down) is already covered by the
root `package.json` scripts and `SPRINT_0_IMPLEMENTATION_PLAN.md`
Chapter 18's documented workflow — adding scripts here "just in case"
would violate the KISS principle both architecture documents establish.
Future candidates once a real need exists: a database migration runner,
a seed-data script, a release/changelog script.
