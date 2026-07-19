/**
 * Password-strength policy.
 *
 * Implements `API_SPECIFICATION.md` §27's "password meets minimum
 * strength policy (length + character variety)" rule (`WEAK_PASSWORD`,
 * 422) — defined exactly once here, shared by the register and
 * change-password validators instead of being duplicated per module.
 */

const MIN_LENGTH = 10;
const MIN_CHARACTER_CLASSES = 3;

export function isStrongPassword(password) {
  if (typeof password !== 'string' || password.length < MIN_LENGTH)
    return false;

  const characterClasses = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/];
  const satisfiedClasses = characterClasses.filter((pattern) =>
    pattern.test(password),
  ).length;

  return satisfiedClasses >= MIN_CHARACTER_CLASSES;
}

export const PASSWORD_POLICY_DESCRIPTION = `At least ${MIN_LENGTH} characters, using at least ${MIN_CHARACTER_CLASSES} of: lowercase, uppercase, digit, symbol.`;

export default { isStrongPassword, PASSWORD_POLICY_DESCRIPTION };
