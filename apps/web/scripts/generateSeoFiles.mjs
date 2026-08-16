/**
 * generateSeoFiles.mjs — Phase 20 (SEO) §19/§20. Writes `dist/sitemap.xml`
 * and `dist/robots.txt` from the same route manifest the prerender
 * pipeline uses (`fetchRouteManifest.mjs`) — one source of truth for
 * "what's indexable," not two hand-maintained lists that can drift.
 *
 * Called automatically at the end of `prerender.mjs`, and exposed as its
 * own `npm run generate:seo-files` for a faster iteration loop when only
 * these two files need regenerating (no browser, no rebuild).
 *
 * ORIGIN: reads `VITE_PUBLIC_SITE_URL` — the SAME variable `vite build`
 * itself reads, loaded from `apps/web/.env` (or an already-exported shell
 * var) so this script and the app can never disagree about the origin —
 * never fabricates a production domain. Unset locally falls back to the
 * same dev origin `seoConfig.js`'s runtime fallback uses, with the same
 * loud warning, so a production run without the var set is impossible to
 * miss.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { fetchRouteManifest } from './lib/fetchRouteManifest.mjs';
import { buildSitemapXml, buildRobotsTxt } from './lib/buildSitemap.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

dotenv.config({ path: path.join(ROOT, '.env') });

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000/api/v1';
const LOCALES = ['hy', 'ru', 'en'];
const DEFAULT_LOCALE = 'hy';
const LOCAL_DEV_FALLBACK_ORIGIN = 'http://localhost:5175';

function log(message) {
  // eslint-disable-next-line no-console -- CLI build script, console output is the entire UI
  console.log(`[generate-seo-files] ${message}`);
}

function resolveOrigin() {
  const configured = process.env.VITE_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  // eslint-disable-next-line no-console -- deliberate build-time signal, mirrors seoConfig.js's getSiteOrigin()
  console.warn(
    '[generate-seo-files] VITE_PUBLIC_SITE_URL is not set — sitemap.xml/' +
      `robots.txt will use ${LOCAL_DEV_FALLBACK_ORIGIN}. Set ` +
      'VITE_PUBLIC_SITE_URL before generating production SEO files.',
  );
  return LOCAL_DEV_FALLBACK_ORIGIN;
}

export async function generateSeoFiles({ manifest: providedManifest } = {}) {
  fs.mkdirSync(DIST, { recursive: true });
  const origin = resolveOrigin();

  // Accepts an already-fetched manifest (prerender.mjs's own crawl target
  // list) so a combined run never fetches categories/destinations/
  // companies/listings from the API twice — real request pressure this
  // script previously added on top of the ~228-route crawl for no reason,
  // right when a rate-limit window is least likely to have room left.
  // Standalone use (`npm run generate:seo-files`) still fetches its own.
  let manifest = providedManifest;
  if (!manifest) {
    log(`Fetching route manifest from ${API_BASE_URL}...`);
    manifest = await fetchRouteManifest({
      apiBaseUrl: API_BASE_URL,
      locales: LOCALES,
    });
  }

  const sitemapXml = buildSitemapXml(manifest, origin, DEFAULT_LOCALE);
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sitemapXml, 'utf8');
  log(`Wrote dist/sitemap.xml (${manifest.length} URLs).`);

  const robotsTxt = buildRobotsTxt(origin);
  fs.writeFileSync(path.join(DIST, 'robots.txt'), robotsTxt, 'utf8');
  log('Wrote dist/robots.txt.');
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  generateSeoFiles().catch((err) => {
    // eslint-disable-next-line no-console -- CLI script fatal-error path
    console.error('[generate-seo-files] Fatal error:', err);
    process.exitCode = 1;
  });
}

export default generateSeoFiles;
