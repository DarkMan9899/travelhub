/**
 * Money value object.
 *
 * Implements Sprint 5's "never use floating-point values for money" rule
 * and `DATABASE_ARCHITECTURE.md` §2's "money is always stored as a
 * fixed-point decimal paired with an explicit currency_id" convention.
 *
 * Represented internally as an integer count of the currency's smallest
 * unit ("minor units" — cents for USD/EUR, luma for AMD) plus a currency
 * code, so every arithmetic operation stays on integers. `mysql2` returns
 * `DECIMAL` columns as strings (never JS numbers) for exactly this
 * reason — always go through `Money.fromDecimalString`, never
 * `parseFloat`, when reading a money column back out of a Repository.
 *
 * Domain layer (`src/core/`) — depends on nothing outside `core`
 * (BACKEND_ARCHITECTURE.md §3.1's dependency rule), so failures here are
 * plain `TypeError`s, not `AppError` subclasses; a Service maps them at
 * the boundary if a user-facing message is needed.
 */

const DECIMAL_STRING = /^-?\d+(\.\d+)?$/;

export class Money {
  #minorUnits;

  #currency;

  #decimalPlaces;

  constructor(minorUnits, currency, decimalPlaces = 2) {
    if (!Number.isInteger(minorUnits)) {
      throw new TypeError(
        'Money must be constructed from an integer minor-unit count.',
      );
    }
    if (typeof currency !== 'string' || currency.trim().length === 0) {
      throw new TypeError('Money requires a currency code.');
    }
    if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0) {
      throw new TypeError('decimalPlaces must be a non-negative integer.');
    }
    this.#minorUnits = minorUnits;
    this.#currency = currency.toUpperCase();
    this.#decimalPlaces = decimalPlaces;
  }

  static zero(currency, decimalPlaces = 2) {
    return new Money(0, currency, decimalPlaces);
  }

  /** Parses a MySQL DECIMAL column's string value — never a float. */
  static fromDecimalString(value, currency, decimalPlaces = 2) {
    const str = String(value).trim();
    if (!DECIMAL_STRING.test(str)) {
      throw new TypeError(`"${value}" is not a valid decimal string.`);
    }
    const negative = str.startsWith('-');
    const [whole, fraction = ''] = str.replace('-', '').split('.');
    const paddedFraction = `${fraction}${'0'.repeat(decimalPlaces)}`.slice(
      0,
      decimalPlaces,
    );
    const minorUnits =
      Number(`${whole}${paddedFraction}`) * (negative ? -1 : 1);
    return new Money(minorUnits, currency, decimalPlaces);
  }

  /** Serializes back to a decimal string suitable for a parameterized query. */
  toDecimalString() {
    const sign = this.#minorUnits < 0 ? '-' : '';
    const digits = Math.abs(this.#minorUnits)
      .toString()
      .padStart(this.#decimalPlaces + 1, '0');
    if (this.#decimalPlaces === 0) return `${sign}${digits}`;
    const whole = digits.slice(0, digits.length - this.#decimalPlaces);
    const fraction = digits.slice(digits.length - this.#decimalPlaces);
    return `${sign}${whole}.${fraction}`;
  }

  get minorUnits() {
    return this.#minorUnits;
  }

  get currency() {
    return this.#currency;
  }

  #assertSameCurrency(other) {
    if (!(other instanceof Money) || other.currency !== this.#currency) {
      throw new TypeError(
        `Cannot combine ${this.#currency} with ${other?.currency ?? typeof other}.`,
      );
    }
  }

  add(other) {
    this.#assertSameCurrency(other);
    return new Money(
      this.#minorUnits + other.minorUnits,
      this.#currency,
      this.#decimalPlaces,
    );
  }

  subtract(other) {
    this.#assertSameCurrency(other);
    return new Money(
      this.#minorUnits - other.minorUnits,
      this.#currency,
      this.#decimalPlaces,
    );
  }

  multiply(factor) {
    if (typeof factor !== 'number' || !Number.isFinite(factor)) {
      throw new TypeError('Money can only be multiplied by a finite number.');
    }
    return new Money(
      Math.round(this.#minorUnits * factor),
      this.#currency,
      this.#decimalPlaces,
    );
  }

  isNegative() {
    return this.#minorUnits < 0;
  }

  isZero() {
    return this.#minorUnits === 0;
  }

  isGreaterThan(other) {
    this.#assertSameCurrency(other);
    return this.#minorUnits > other.minorUnits;
  }

  equals(other) {
    return (
      other instanceof Money &&
      this.#currency === other.currency &&
      this.#minorUnits === other.minorUnits
    );
  }
}

export default Money;
