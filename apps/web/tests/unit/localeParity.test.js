/**
 * i18n remediation (2026): guards translation-key parity across all three
 * locales so a missing/stale/mismatched key is a test failure, not
 * something discovered later at runtime behind a `t()` fallback string.
 *
 * Russian legitimately carries more raw keys than English/Armenian — CLDR
 * gives `ru` a 4-form plural system (`_one`/`_few`/`_many`/`_other`)
 * versus the 2-form system (`_one`/`_other`) that `en`/`hy` use. Comparing
 * raw key sets would flag every plural string as "missing" in en/hy, so
 * parity is checked at the plural-stripped base-key level instead — the
 * same approach validated ad hoc during the i18n audit before being
 * ported here as a permanent, CI-enforced check.
 */

import { describe, test, expect } from 'vitest';
import hyCommon from '../../public/locales/hy/common.json';
import ruCommon from '../../public/locales/ru/common.json';
import enCommon from '../../public/locales/en/common.json';

const LOCALES = { en: enCommon, hy: hyCommon, ru: ruCommon };
const PLURAL_SUFFIXES = ['_zero', '_one', '_two', '_few', '_many', '_other'];

function flatten(obj, prefix = '', out = {}) {
  Object.entries(obj).forEach(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      flatten(v, key, out);
    } else {
      out[key] = v;
    }
  });
  return out;
}

function baseKey(key) {
  const suffix = PLURAL_SUFFIXES.find((suf) => key.endsWith(suf));
  return suffix ? key.slice(0, -suffix.length) : key;
}

function interpolationTokens(value) {
  if (typeof value !== 'string') return new Set();
  return new Set(
    [...value.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]),
  );
}

function markupTags(value) {
  if (typeof value !== 'string') return new Set();
  return new Set([...value.matchAll(/<\/?(\w+)>/g)].map((m) => m[0]));
}

const flat = Object.fromEntries(
  Object.entries(LOCALES).map(([locale, json]) => [locale, flatten(json)]),
);

const baseKeysByLocale = Object.fromEntries(
  Object.entries(flat).map(([locale, keys]) => [
    locale,
    new Set(Object.keys(keys).map(baseKey)),
  ]),
);

const allBaseKeys = new Set(
  Object.values(baseKeysByLocale).flatMap((s) => [...s]),
);

describe('locale translation parity (en / hy / ru)', () => {
  test('every base key exists in all three locales', () => {
    const missing = [];
    allBaseKeys.forEach((key) => {
      const missingFrom = Object.keys(LOCALES).filter(
        (locale) => !baseKeysByLocale[locale].has(key),
      );
      if (missingFrom.length > 0) {
        missing.push(`${key} — missing from: ${missingFrom.join(', ')}`);
      }
    });
    expect(missing).toEqual([]);
  });

  test('no locale file has an empty-string translation value', () => {
    const empties = [];
    Object.entries(flat).forEach(([locale, keys]) => {
      Object.entries(keys).forEach(([key, value]) => {
        if (value === '') empties.push(`${locale}:${key}`);
      });
    });
    expect(empties).toEqual([]);
  });

  test('interpolation variables ({{var}}) match across locales for shared keys', () => {
    const sharedKeys = Object.keys(flat.en).filter(
      (k) => k in flat.hy && k in flat.ru,
    );
    const mismatches = [];
    sharedKeys.forEach((key) => {
      const tokensByLocale = Object.fromEntries(
        Object.entries(LOCALES).map(([locale]) => [
          locale,
          [...interpolationTokens(flat[locale][key])].sort().join(','),
        ]),
      );
      const distinct = new Set(Object.values(tokensByLocale));
      if (distinct.size > 1 && [...distinct].some((v) => v !== '')) {
        mismatches.push(`${key}: ${JSON.stringify(tokensByLocale)}`);
      }
    });
    expect(mismatches).toEqual([]);
  });

  test('markup tags (e.g. <1></1>) match across locales for shared keys', () => {
    const sharedKeys = Object.keys(flat.en).filter(
      (k) => k in flat.hy && k in flat.ru,
    );
    const mismatches = [];
    sharedKeys.forEach((key) => {
      const tagsByLocale = Object.fromEntries(
        Object.entries(LOCALES).map(([locale]) => [
          locale,
          [...markupTags(flat[locale][key])].sort().join(','),
        ]),
      );
      const distinct = new Set(Object.values(tagsByLocale));
      if (distinct.size > 1 && [...distinct].some((v) => v !== '')) {
        mismatches.push(`${key}: ${JSON.stringify(tagsByLocale)}`);
      }
    });
    expect(mismatches).toEqual([]);
  });
});
