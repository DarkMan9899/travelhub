/**
 * useNoIndex — sets `<meta name="robots" content="noindex,nofollow">` for
 * the lifetime of the mounting component. Phase 20 (SEO) §3's defense-in-
 * depth rule: private/authenticated areas must carry this even though
 * they're also never in the prerender route list or the sitemap — a
 * crawler that somehow reaches one of these URLs (an old indexed link, a
 * stray external link) must still see an explicit noindex directive, not
 * rely on absence-from-sitemap alone.
 *
 * Mounted once per private layout (Auth/CustomerAccount/Partner/Admin)
 * rather than per page — every page under these layouts is private, so
 * there's nothing page-specific to configure.
 */

import { useEffect } from 'react';

export default function useNoIndex() {
  useEffect(() => {
    let tag = document.querySelector('meta[name="robots"]');
    const created = !tag;
    const previousContent = created ? null : tag.getAttribute('content');
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute('name', 'robots');
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', 'noindex, nofollow');

    return () => {
      if (created) {
        tag.remove();
      } else if (previousContent !== null) {
        tag.setAttribute('content', previousContent);
      }
    };
  }, []);
}
