/**
 * Shared Prettier preset — values fixed in
 * SPRINT_0_IMPLEMENTATION_PLAN.md Chapter 11. Both apps and the root
 * extend this single source rather than declaring their own values.
 */
module.exports = {
  printWidth: 80,
  tabWidth: 2,
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  arrowParens: 'always',
  endOfLine: 'lf',
};
