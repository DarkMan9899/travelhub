/**
 * Client-side mirror of `apps/api/src/core/domain/passwordPolicy.js`
 * (FRONTEND_ARCHITECTURE.md §15.2 — validation must match the API
 * field-for-field, never looser or stricter). Frontend and backend are
 * separate packages with no shared import path for domain logic this
 * small, so the rule is restated here; if the backend policy ever
 * changes, this must change with it.
 */

const MIN_LENGTH = 10;
const MIN_CHARACTER_CLASSES = 3;

export function isStrongPassword(password) {
  if (typeof password !== 'string' || password.length < MIN_LENGTH) {
    return false;
  }
  const characterClasses = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/];
  const satisfiedClasses = characterClasses.filter((pattern) =>
    pattern.test(password),
  ).length;
  return satisfiedClasses >= MIN_CHARACTER_CLASSES;
}

export { MIN_LENGTH, MIN_CHARACTER_CLASSES };
