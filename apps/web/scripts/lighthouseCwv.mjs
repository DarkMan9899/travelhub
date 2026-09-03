/**
 * lighthouseCwv — 2026 SEO/performance audit. Real Core Web Vitals
 * measurement against the actual PRODUCTION build (`vite build` +
 * `vite preview`), never Vite dev mode — dev mode ships unminified,
 * unbundled modules and reports vitals no real visitor would ever see.
 *
 * USAGE
 *   npm run build && npm run preview -- --port 5177   # in one terminal
 *   LIGHTHOUSE_ORIGIN=http://localhost:5177 node scripts/lighthouseCwv.mjs
 *
 *   LIGHTHOUSE_ORIGIN defaults to http://localhost:5177 if unset.
 *
 * Runs mobile + desktop against Home and Listing Detail, and mobile
 * against Category (the 5 targets this audit's brief asked for),
 * throttled via Lighthouse's own well-known "Slow 4G"-equivalent mobile
 * profile (`throttlingMethod: 'simulate'`, the same simulated-throttling
 * approach `lighthouse --view` uses by default) — desktop runs
 * unthrottled at broadband, matching Lighthouse's own desktop preset.
 * Prints one JSON summary per target and writes the full set to
 * `lighthouse-results.json` in the CURRENT working directory.
 *
 * A real listing slug is required for the ListingDetail target — update
 * `PAGES` below if the demo seed data changes.
 */
import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import fs from 'node:fs';

const ORIGIN = process.env.LIGHTHOUSE_ORIGIN ?? 'http://localhost:5177';

const PAGES = [
  { name: 'Home', path: '/en' },
  {
    name: 'ListingDetail',
    path: '/en/listings/demo-apartments-grand-yerevan-apartment',
  },
  { name: 'Category', path: '/en/categories/hotels' },
];

const MOBILE_SETTINGS = {
  formFactor: 'mobile',
  screenEmulation: {
    mobile: true,
    width: 412,
    height: 823,
    deviceScaleFactor: 1.75,
    disabled: false,
  },
  throttling: {
    rttMs: 150,
    throughputKbps: 1638.4,
    cpuSlowdownMultiplier: 4,
    requestLatencyMs: 150 * 3.75,
    downloadThroughputKbps: 1638.4 * 0.9,
    uploadThroughputKbps: 675 * 0.9,
  },
};

const DESKTOP_SETTINGS = {
  formFactor: 'desktop',
  screenEmulation: {
    mobile: false,
    width: 1350,
    height: 940,
    deviceScaleFactor: 1,
    disabled: false,
  },
  throttling: {
    rttMs: 40,
    throughputKbps: 10240,
    cpuSlowdownMultiplier: 1,
    requestLatencyMs: 0,
    downloadThroughputKbps: 0,
    uploadThroughputKbps: 0,
  },
};

const TARGETS = [
  { page: 'Home', device: 'mobile' },
  { page: 'Home', device: 'desktop' },
  { page: 'ListingDetail', device: 'mobile' },
  { page: 'ListingDetail', device: 'desktop' },
  { page: 'Category', device: 'mobile' },
];

function log(message) {
  // eslint-disable-next-line no-console -- CLI script, console output is the entire UI
  console.log(message);
}

async function run() {
  const chrome = await launch({ chromeFlags: ['--headless=new'] });
  const results = [];
  try {
    // eslint-disable-next-line no-restricted-syntax -- one shared Chrome instance, sequential by design
    for (const target of TARGETS) {
      const pageInfo = PAGES.find((p) => p.name === target.page);
      const url = `${ORIGIN}${pageInfo.path}`;
      const deviceSettings =
        target.device === 'mobile' ? MOBILE_SETTINGS : DESKTOP_SETTINGS;

      // eslint-disable-next-line no-await-in-loop -- sequential by design, one Chrome instance
      const runnerResult = await lighthouse(
        url,
        { port: chrome.port, output: 'json', onlyCategories: ['performance'] },
        {
          extends: 'lighthouse:default',
          settings: { ...deviceSettings, throttlingMethod: 'simulate' },
        },
      );

      const { lhr } = runnerResult;
      const audit = (id) => lhr.audits[id];
      const summary = {
        page: target.page,
        device: target.device,
        url,
        performanceScore: lhr.categories.performance.score,
        LCP_ms: audit('largest-contentful-paint')?.numericValue,
        CLS: audit('cumulative-layout-shift')?.numericValue,
        FCP_ms: audit('first-contentful-paint')?.numericValue,
        TBT_ms: audit('total-blocking-time')?.numericValue,
        SI_ms: audit('speed-index')?.numericValue,
        TTI_ms: audit('interactive')?.numericValue,
        transferredBytes: audit('total-byte-weight')?.numericValue,
        requestCount: audit('network-requests')?.details?.items?.length,
      };
      log(JSON.stringify(summary, null, 2));
      results.push(summary);
    }
  } finally {
    await chrome.kill();
  }
  fs.writeFileSync('lighthouse-results.json', JSON.stringify(results, null, 2));
  log('\nDONE. Wrote lighthouse-results.json');
}

run().catch((err) => {
  // eslint-disable-next-line no-console -- CLI script fatal-error path
  console.error('[lighthouseCwv] Fatal error:', err);
  process.exitCode = 1;
});
