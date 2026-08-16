/**
 * Phase 20 — SEO configuration. Single source of truth for the values
 * every canonical/hreflang/OG/JSON-LD builder needs: the public site
 * origin, the brand name, and locale-related constants already owned by
 * `translations/i18n.js` (re-exported here so SEO code has one import).
 *
 * `getSiteOrigin()` never fabricates a production domain (Phase 20 §2's
 * hard rule). It reads `VITE_PUBLIC_SITE_URL` when set; in a browser with
 * that var unset it falls back to `window.location.origin` (always
 * correct for whatever host is actually serving the page); in a Node
 * build/prerender context with neither available it falls back to the
 * local dev preview origin and logs a warning so a production build
 * without the var set is loud, not silently wrong.
 */

export const SITE_BRAND_NAME = 'desavii';

export const SUPPORTED_LOCALES = ['hy', 'ru', 'en'];
export const DEFAULT_LOCALE = 'hy';

// The IANA-ish hreflang codes for each supported locale. Armenian and
// Russian map directly; `x-default` is emitted separately by callers,
// not stored here, since it isn't one of the app's own locale codes.
export const HREFLANG_BY_LOCALE = {
  hy: 'hy',
  ru: 'ru',
  en: 'en',
};

const LOCAL_DEV_FALLBACK_ORIGIN = 'http://localhost:5175';

export function getSiteOrigin() {
  const configured = import.meta.env?.VITE_PUBLIC_SITE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  // eslint-disable-next-line no-console -- deliberate build-time signal:
  // a production prerender/sitemap run with no configured origin and no
  // window must not silently emit localhost URLs without a loud warning.
  console.warn(
    '[seo] VITE_PUBLIC_SITE_URL is not set — falling back to ' +
      `${LOCAL_DEV_FALLBACK_ORIGIN}. Set VITE_PUBLIC_SITE_URL before ` +
      'building for production.',
  );
  return LOCAL_DEV_FALLBACK_ORIGIN;
}

export default {
  SITE_BRAND_NAME,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  HREFLANG_BY_LOCALE,
  getSiteOrigin,
};
