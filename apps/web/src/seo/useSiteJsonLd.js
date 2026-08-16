/**
 * useSiteJsonLd — injects the site-wide Organization + WebSite JSON-LD
 * once per mount, independent of whatever per-page `useSeo` call also
 * runs. Deliberately separate from `useSeo` (which owns title/
 * description/canonical/robots/hreflang — all things that change per
 * page) since Organization/WebSite identity is the same on every public
 * page and should never be clobbered by a page-level unmount.
 *
 * Mounted once, at `PublicLayout` (Phase 20, SEO) — private/authenticated
 * layouts never call this, since their pages are `noindex` and have no
 * use for site-identity schema a crawler will never see.
 */

import { useEffect } from 'react';
import {
  buildOrganizationSchema,
  buildWebsiteSchema,
} from './structuredData.js';

export default function useSiteJsonLd(locale) {
  useEffect(() => {
    // A prerendered snapshot already has this exact effect's output baked
    // into its <head> (scripts/prerender.mjs captures it mid-build) —
    // clearing this hook's own previously-created tags before adding a
    // fresh set stops the client boot from doubling them on top of the
    // prerendered markup. `data-seo-source="site"` scopes this to only
    // this hook's tags, never `useSeo`'s page-level JSON-LD.
    document
      .querySelectorAll(
        'script[type="application/ld+json"][data-seo-source="site"]',
      )
      .forEach((tag) => tag.remove());
    const scripts = [buildOrganizationSchema(), buildWebsiteSchema(locale)].map(
      (entry) => {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.dataset.seoSource = 'site';
        script.textContent = JSON.stringify(entry);
        document.head.appendChild(script);
        return script;
      },
    );

    return () => {
      scripts.forEach((script) => script.remove());
    };
  }, [locale]);
}
