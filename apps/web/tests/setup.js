/**
 * Shared Vitest setup — runs before every test file.
 * FRONTEND_ARCHITECTURE.md §35: extends expect() with jest-dom matchers
 * platform-wide so no individual test file needs to import them itself.
 */
import '@testing-library/jest-dom/vitest';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// A dedicated, test-only i18next instance using INLINE resources rather
// than src/translations/i18n.js's i18next-http-backend. The production
// config fetches translation JSON over HTTP from the dev/prod server —
// there is no real server behind a jsdom test environment to serve that
// request from, so reusing it here would make every test flake on a
// network call. Loading the same JSON files directly keeps tests fast,
// deterministic, and still exercised against the real translation
// content (not a mocked/fake one).
import hyCommon from '../src/translations/hy/common.json';
import ruCommon from '../src/translations/ru/common.json';
import enCommon from '../src/translations/en/common.json';

i18n.use(initReactI18next).init({
  lng: 'hy',
  fallbackLng: 'hy',
  ns: ['common'],
  defaultNS: 'common',
  resources: {
    hy: { common: hyCommon },
    ru: { common: ruCommon },
    en: { common: enCommon },
  },
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});
