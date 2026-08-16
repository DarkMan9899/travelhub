/**
 * useSeo — Phase 20's single per-page metadata hook, superseding
 * `hooks/useDocumentMeta.js` (title + description only). Manages every
 * `<head>` tag a page needs: title, description, canonical, robots,
 * hreflang alternates, Open Graph, Twitter card, and JSON-LD structured
 * data — all restored to their previous value on unmount, exactly like
 * the hook it replaces.
 *
 * This remains a client-side effect (no SSR exists in this app — see
 * `docs/ARCHITECTURE_DECISIONS.md` Phase 20 entry). What makes this
 * genuinely crawlable is the build-time prerender pipeline
 * (`scripts/prerender.mjs`) that renders each indexable route with a real
 * browser and snapshots the resulting `<head>`/`<body>` to a static file
 * *before* a crawler ever requests it — this hook is what produces the
 * content that snapshot captures. Pages never call this hook are private/
 * authenticated and correctly stay client-render-only.
 */

import { useEffect } from 'react';
import { buildHreflangAlternates, buildLocaleUrl } from './urls.js';
import { SITE_BRAND_NAME } from './seoConfig.js';

function upsertTag(selector, createTag, setContent) {
  let tag = document.querySelector(selector);
  let created = false;
  if (!tag) {
    tag = createTag();
    document.head.appendChild(tag);
    created = true;
  }
  const previousContent = created ? null : tag.getAttribute('content');
  setContent(tag);
  return { tag, created, previousContent };
}

function upsertMeta(attr, key, content) {
  return upsertTag(
    `meta[${attr}="${key}"]`,
    () => {
      const el = document.createElement('meta');
      el.setAttribute(attr, key);
      return el;
    },
    (el) => el.setAttribute('content', content),
  );
}

function restoreOrRemoveMeta(handle) {
  if (!handle) return;
  const { tag, created, previousContent } = handle;
  if (created) {
    tag.remove();
  } else if (previousContent !== null) {
    tag.setAttribute('content', previousContent);
  }
}

/**
 * @param {object} params
 * @param {string} params.title - full, already-composed page title.
 * @param {string} params.description - meta/OG/Twitter description.
 * @param {string} params.locale - current locale (hy/ru/en).
 * @param {string} [params.path] - locale-free canonical path (e.g.
 *   `listings/my-slug`, `''` for home). Omit only for pages with no real
 *   canonical URL of their own (there are none among indexable pages).
 * @param {boolean} [params.noindex] - emit `noindex` in robots meta.
 * @param {boolean} [params.nofollow] - emit `nofollow` in robots meta.
 * @param {boolean} [params.skipHreflang] - omit hreflang alternates (used
 *   for pages that intentionally have no cross-locale equivalent, e.g. a
 *   404).
 * @param {string} [params.image] - absolute OG/Twitter image URL.
 * @param {'website'|'article'|'product'} [params.type] - og:type.
 * @param {object[]} [params.jsonLd] - array of JSON-LD objects, each
 *   rendered as its own `<script type="application/ld+json">`.
 */
export default function useSeo({
  title,
  description,
  locale,
  path,
  noindex = false,
  nofollow = false,
  skipHreflang = false,
  image,
  type = 'website',
  jsonLd,
}) {
  const jsonLdKey = jsonLd ? JSON.stringify(jsonLd) : '';

  useEffect(() => {
    const previousTitle = document.title;
    if (title) document.title = title;

    const handles = [];
    if (description) {
      handles.push(upsertMeta('name', 'description', description));
    }

    const robotsContent = [
      noindex ? 'noindex' : 'index',
      nofollow ? 'nofollow' : 'follow',
    ].join(', ');
    handles.push(upsertMeta('name', 'robots', robotsContent));

    const canonicalUrl =
      path !== undefined ? buildLocaleUrl(locale, path) : null;
    let canonicalTag = null;
    let canonicalCreated = false;
    if (canonicalUrl) {
      canonicalTag = document.querySelector('link[rel="canonical"]');
      canonicalCreated = !canonicalTag;
      if (!canonicalTag) {
        canonicalTag = document.createElement('link');
        canonicalTag.setAttribute('rel', 'canonical');
        document.head.appendChild(canonicalTag);
      }
      canonicalTag.setAttribute('href', canonicalUrl);
    }

    // A prerendered snapshot's own <head> already carries a full hreflang
    // set (this same effect, captured mid-build by scripts/prerender.mjs)
    // — clearing any that exist before adding this render's set, rather
    // than only on unmount, is what stops the client boot from doubling
    // them up on top of the prerendered markup.
    document
      .querySelectorAll('link[rel="alternate"][hreflang]')
      .forEach((tag) => tag.remove());
    const hreflangTags =
      !skipHreflang && path !== undefined
        ? buildHreflangAlternates(path).map(({ hrefLang, href }) => {
            const link = document.createElement('link');
            link.setAttribute('rel', 'alternate');
            link.setAttribute('hreflang', hrefLang);
            link.setAttribute('href', href);
            document.head.appendChild(link);
            return link;
          })
        : [];

    if (title) {
      handles.push(upsertMeta('property', 'og:title', title));
      handles.push(upsertMeta('name', 'twitter:title', title));
    }
    if (description) {
      handles.push(upsertMeta('property', 'og:description', description));
      handles.push(upsertMeta('name', 'twitter:description', description));
    }
    handles.push(upsertMeta('property', 'og:type', type));
    handles.push(upsertMeta('property', 'og:site_name', SITE_BRAND_NAME));
    if (canonicalUrl) {
      handles.push(upsertMeta('property', 'og:url', canonicalUrl));
    }
    if (image) {
      handles.push(upsertMeta('property', 'og:image', image));
      handles.push(upsertMeta('name', 'twitter:card', 'summary_large_image'));
      handles.push(upsertMeta('name', 'twitter:image', image));
    } else {
      handles.push(upsertMeta('name', 'twitter:card', 'summary'));
    }

    // Same doubling risk as hreflang above: a prerendered snapshot already
    // has this page's own JSON-LD baked in. `data-seo-source="page"`
    // scopes the cleanup to only this hook's own tags — `useSiteJsonLd`'s
    // site-wide Organization/WebSite scripts carry a different marker and
    // must never be touched here.
    document
      .querySelectorAll(
        'script[type="application/ld+json"][data-seo-source="page"]',
      )
      .forEach((tag) => tag.remove());
    const jsonLdScripts = (jsonLd ?? []).map((entry) => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.dataset.seoSource = 'page';
      script.textContent = JSON.stringify(entry);
      document.head.appendChild(script);
      return script;
    });

    return () => {
      document.title = previousTitle;
      handles.forEach(restoreOrRemoveMeta);
      if (canonicalTag) {
        if (canonicalCreated) canonicalTag.remove();
        else canonicalTag.removeAttribute('href');
      }
      hreflangTags.forEach((tag) => tag.remove());
      jsonLdScripts.forEach((script) => script.remove());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- jsonLd is
    // compared via jsonLdKey (its serialized form) so callers don't need
    // to memoize the array/object literal themselves.
  }, [
    title,
    description,
    locale,
    path,
    noindex,
    nofollow,
    skipHreflang,
    image,
    type,
    jsonLdKey,
  ]);
}
