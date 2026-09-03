/**
 * ScrollRestoration — the single shared owner of scroll position across
 * route changes (public-frontend stabilization audit, 2026). Mounted
 * once in `AppRoutes`, inside `BrowserRouter` — no page/component should
 * call `window.scrollTo()` of its own for "new page, start at top"
 * purposes; this is the one place that decides.
 *
 * This app uses a plain `<BrowserRouter>` + `<Routes>` (not a v6.4+ data
 * router), so react-router-dom's own `<ScrollRestoration>` component
 * (which requires `createBrowserRouter`/`RouterProvider`) isn't
 * available — this reimplements the same four cases by hand:
 *
 * 1. Hash present (`#section`) — scroll to that element, on both a
 *    fresh navigation and a direct/initial load with a hash in the URL.
 *    An unresolvable hash leaves scroll untouched rather than yanking
 *    the page to the top.
 * 2. Browser Back/Forward (`navigationType === 'POP'`) — restore the
 *    scroll position this exact history entry (`location.key`) had when
 *    the user left it, saved in an in-memory `Map` (session-lifetime
 *    only, matching every other browser's own scroll-restoration
 *    memory — no need to persist across a hard reload). Falls back to
 *    the top if this entry was never visited with a saved position
 *    (e.g. the very first entry in history).
 * 3. A genuine new navigation (`PUSH`/`REPLACE`) whose *pathname*
 *    changed — scroll to top. This is the fix for the reported bug: a
 *    new route opening at the previous page's scroll position.
 * 4. Everything else — same pathname, no hash, not a POP (a search-param
 *    change from a filter chip, a modal opened via query string, a
 *    locale switch that maps to the identical page once the leading
 *    `/:locale` segment is ignored) — scroll is left exactly where it
 *    is. This is what keeps a locale switch or a Search filter update
 *    from discarding the user's place on the page.
 */

import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { SUPPORTED_LOCALES } from '../translations/i18n.js';

// In-memory only — a scroll position from a session that no longer
// exists (a hard reload, a new tab) is not meaningful to restore.
const scrollPositionsByKey = new Map();

const LOCALE_PREFIX_PATTERN = new RegExp(
  `^/(?:${SUPPORTED_LOCALES.join('|')})(?=/|$)`,
);

function pathnameWithoutLocale(pathname) {
  return pathname.replace(LOCALE_PREFIX_PATTERN, '');
}

export default function ScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const previousPathnameRef = useRef(null);

  useEffect(() => {
    const previousPathname = previousPathnameRef.current;

    if (location.hash) {
      const target = document.getElementById(
        decodeURIComponent(location.hash.slice(1)),
      );
      target?.scrollIntoView({ block: 'start' });
    } else if (navigationType === 'POP') {
      const saved = scrollPositionsByKey.get(location.key);
      window.scrollTo(saved?.x ?? 0, saved?.y ?? 0);
    } else if (previousPathname !== location.pathname) {
      const isLocaleOnlySwitch =
        previousPathname !== null &&
        pathnameWithoutLocale(previousPathname) ===
          pathnameWithoutLocale(location.pathname);
      if (!isLocaleOnlySwitch) {
        window.scrollTo(0, 0);
      }
    }
    // else: same pathname, no hash, not a POP — a query/hash-only
    // change that isn't a genuine page navigation. Leave scroll alone.

    previousPathnameRef.current = location.pathname;

    return () => {
      // Captures the outgoing entry's own `location`/`key` via this
      // effect's closure — records where the user was on the page
      // they're now leaving, so a later POP back to it can restore it.
      scrollPositionsByKey.set(location.key, {
        x: window.scrollX,
        y: window.scrollY,
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `location`
    // (not `location.pathname`/`.hash`/`.key` individually) is the
    // correct dependency: every field this effect reads comes from the
    // same location object, and react-router already gives every
    // navigation a new object, so there's no missed-update risk.
  }, [location, navigationType]);

  return null;
}
