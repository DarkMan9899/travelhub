import { describe, test, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useSeo from './useSeo.js';

function hreflangTags() {
  return [...document.querySelectorAll('link[rel="alternate"][hreflang]')];
}

function pageJsonLdScripts() {
  return [
    ...document.querySelectorAll(
      'script[type="application/ld+json"][data-seo-source="page"]',
    ),
  ];
}

afterEach(() => {
  document.head
    .querySelectorAll('link, meta, script, title')
    .forEach((el) => el.remove());
});

describe('useSeo', () => {
  test('does not duplicate hreflang links already present from a prerendered snapshot', () => {
    // Simulates the exact real-world scenario: a prerendered <head> already
    // carries the correct hreflang set before the client bundle boots and
    // this hook's effect runs for the first time.
    ['hy', 'ru', 'en', 'x-default'].forEach((hrefLang) => {
      const link = document.createElement('link');
      link.setAttribute('rel', 'alternate');
      link.setAttribute('hreflang', hrefLang);
      link.setAttribute('href', `https://desavii.com/${hrefLang}`);
      document.head.appendChild(link);
    });
    expect(hreflangTags()).toHaveLength(4);

    renderHook(() =>
      useSeo({ title: 'Home', description: 'Desc', locale: 'hy', path: '' }),
    );

    expect(hreflangTags()).toHaveLength(4);
  });

  test('does not duplicate page-level JSON-LD already present from a prerendered snapshot', () => {
    const stale = document.createElement('script');
    stale.type = 'application/ld+json';
    stale.dataset.seoSource = 'page';
    stale.textContent = JSON.stringify({ '@type': 'Stale' });
    document.head.appendChild(stale);
    expect(pageJsonLdScripts()).toHaveLength(1);

    renderHook(() =>
      useSeo({
        title: 'Home',
        description: 'Desc',
        locale: 'hy',
        path: '',
        jsonLd: [{ '@type': 'WebSite' }],
      }),
    );

    expect(pageJsonLdScripts()).toHaveLength(1);
    expect(pageJsonLdScripts()[0].textContent).toContain('WebSite');
  });

  test('removes hreflang and page JSON-LD tags on unmount', () => {
    const { unmount } = renderHook(() =>
      useSeo({
        title: 'Home',
        description: 'Desc',
        locale: 'hy',
        path: '',
        jsonLd: [{ '@type': 'WebSite' }],
      }),
    );
    expect(hreflangTags().length).toBeGreaterThan(0);
    expect(pageJsonLdScripts()).toHaveLength(1);

    unmount();

    expect(hreflangTags()).toHaveLength(0);
    expect(pageJsonLdScripts()).toHaveLength(0);
  });

  test('skipHreflang leaves no hreflang tags behind, even removing stale ones', () => {
    const stale = document.createElement('link');
    stale.setAttribute('rel', 'alternate');
    stale.setAttribute('hreflang', 'hy');
    document.head.appendChild(stale);

    renderHook(() =>
      useSeo({
        title: 'Not Found',
        description: 'Desc',
        locale: 'hy',
        skipHreflang: true,
        noindex: true,
      }),
    );

    expect(hreflangTags()).toHaveLength(0);
  });
});
