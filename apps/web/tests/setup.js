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
import hyCommon from '../public/locales/hy/common.json';
import ruCommon from '../public/locales/ru/common.json';
import enCommon from '../public/locales/en/common.json';

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

// A shared no-op observer factory — jsdom implements neither
// IntersectionObserver (used by Framer Motion's `whileInView`, Ch. 31's
// scroll-reveal pattern) nor ResizeObserver (used internally by
// embla-carousel, the `home` module's Showcase component). A plain
// constructor function returning an object (rather than a `class`)
// keeps both stubs to one no-op shape without tripping
// max-classes-per-file/class-methods-use-this for methods that are
// intentionally empty.
function createNoopObserver() {
  return {
    observe() {},
    unobserve() {},
    disconnect() {},
  };
}

if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = createNoopObserver;
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = createNoopObserver;
}

// jsdom doesn't implement window.matchMedia at all — embla-carousel
// calls it internally (breakpoint options), and `useReducedMotion`
// reads it too. A single global stub covers both, rather than every
// test file needing its own local mock; individual tests can still
// override `window.matchMedia` locally (e.g. to simulate reduced
// motion) since this only sets a default.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  });
}
