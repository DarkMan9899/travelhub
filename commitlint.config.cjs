/**
 * Conventional Commits, enforced via commitlint + Husky's commit-msg hook.
 * Scope is expected to match a module name from BACKEND_ARCHITECTURE.md
 * Part XI or FRONTEND_ARCHITECTURE.md Chapter 6, or "repo" for root-level
 * tooling changes not owned by any single module.
 * See: SPRINT_0_IMPLEMENTATION_PLAN.md, Chapter 13.
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'chore',
        'docs',
        'refactor',
        'test',
        'ci',
        'build',
        'perf',
      ],
    ],
    'scope-empty': [2, 'never'],
  },
};
