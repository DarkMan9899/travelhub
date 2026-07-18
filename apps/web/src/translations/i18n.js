/**
 * i18next configuration.
 *
 * Implements FRONTEND_ARCHITECTURE.md §16: three supported locales
 * (hy/ru/en), namespace-per-module-family, lazy-loaded via
 * i18next-http-backend (never bundling every locale's every namespace
 * into the initial JS payload), with the platform default (Armenian)
 * as the fallback for any missing key — never a raw key name or blank
 * string, matching API_SPECIFICATION.md §15's identical fallback rule
 * on the server side.
 *
 * Sprint 1 scope: wiring + the "common" namespace only (a few
 * placeholder keys, enough to prove the pipeline — see
 * src/translations/{hy,ru,en}/common.json). No real page content exists
 * yet to translate.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

export const SUPPORTED_LOCALES = ['hy', 'ru', 'en'];
export const DEFAULT_LOCALE = 'hy';

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    supportedLngs: SUPPORTED_LOCALES,
    fallbackLng: DEFAULT_LOCALE,
    ns: ['common'],
    defaultNS: 'common',
    backend: {
      // Namespace files are served as static assets, matched by locale
      // segment — lazy-loaded per FRONTEND_ARCHITECTURE.md §16.3, never
      // bundled upfront.
      loadPath: '/src/translations/{{lng}}/{{ns}}.json',
    },
    detection: {
      // The URL locale segment (FRONTEND_ARCHITECTURE.md §4.1) is the
      // authoritative signal, set explicitly by the router — this
      // detector order is a fallback for the very first, pre-route
      // resolution only.
      order: ['path', 'navigator'],
    },
    interpolation: {
      escapeValue: false, // React already escapes
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
