/**
 * `getStripe` — the one place `loadStripe` is ever called. Memoized per
 * publishable key so Stripe.js (a real script injected onto the page,
 * fetched from js.stripe.com) is only ever loaded ONCE, and only when a
 * component actually needs it — go-live sequencing requires the checkout
 * UI to never initialize Stripe when payments are disabled or the active
 * provider isn't Stripe (`BookingPaymentSection` only renders anything
 * that imports this module inside its `provider === 'stripe'` branch).
 *
 * 2026 SEO/performance audit — root-caused a real prerender anomaly here:
 * `@stripe/stripe-js`'s default entry point (`index.mjs`) has its own
 * module-scope side effect — `Promise.resolve().then(() =>
 * getStripePromise())`, its own comment reads "Execute our own script
 * injection after a tick to give users time to do their own script
 * injection" — that self-injects the Stripe.js `<script>` tag on MERE
 * IMPORT, regardless of whether `getStripe()` below is ever called. Since
 * this module (and therefore that import) ends up in the shared chunk
 * every public page loads, every public page — including ones that never
 * render any payment UI — was silently fetching js.stripe.com. The
 * package ships `@stripe/stripe-js/pure` specifically to opt out of this:
 * identical `loadStripe()` API and behavior once actually called, minus
 * the auto-injection. That entry point is the fix, not a workaround.
 */

import { loadStripe } from '@stripe/stripe-js/pure';

let stripePromise;
let loadedKey;

export function getStripe(publishableKey) {
  if (!publishableKey) return null;
  if (!stripePromise || loadedKey !== publishableKey) {
    loadedKey = publishableKey;
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
}

export default getStripe;
