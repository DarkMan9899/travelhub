import { describe, test, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useSiteJsonLd from './useSiteJsonLd.js';

function siteJsonLdScripts() {
  return [
    ...document.querySelectorAll(
      'script[type="application/ld+json"][data-seo-source="site"]',
    ),
  ];
}

afterEach(() => {
  document.head.querySelectorAll('script').forEach((el) => el.remove());
});

describe('useSiteJsonLd', () => {
  test('does not duplicate site JSON-LD already present from a prerendered snapshot', () => {
    // Simulates useSiteJsonLd's own prior effect run being baked into a
    // prerendered snapshot's <head> before the client bundle boots again.
    ['Organization', 'WebSite'].forEach((type) => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.dataset.seoSource = 'site';
      script.textContent = JSON.stringify({ '@type': type });
      document.head.appendChild(script);
    });
    expect(siteJsonLdScripts()).toHaveLength(2);

    renderHook(() => useSiteJsonLd('hy'));

    expect(siteJsonLdScripts()).toHaveLength(2);
  });

  test('removes its own scripts on unmount, never touching page-level JSON-LD', () => {
    const pageScript = document.createElement('script');
    pageScript.type = 'application/ld+json';
    pageScript.dataset.seoSource = 'page';
    pageScript.textContent = JSON.stringify({ '@type': 'Product' });
    document.head.appendChild(pageScript);

    const { unmount } = renderHook(() => useSiteJsonLd('en'));
    expect(siteJsonLdScripts()).toHaveLength(2);

    unmount();

    expect(siteJsonLdScripts()).toHaveLength(0);
    expect(
      document.querySelector('script[data-seo-source="page"]'),
    ).not.toBeNull();
  });
});
