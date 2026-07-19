/**
 * @travelhub/types — public entry point.
 *
 * Holds shared JSDoc @typedef definitions mirroring the resource shapes
 * in API_SPECIFICATION.md and OPENAPI_SCHEMA_REFERENCE.md (Booking,
 * Listing, Payment, etc.) so apps/web and apps/api can both import the
 * same type documentation instead of two drifting copies.
 *
 * Sprint 1 shipped this package empty — no API resources existed yet.
 * Sprint 5 adds the first real content: the provider-independent
 * analytics event contract (§13), since event names/payloads are exactly
 * the kind of cross-app-shared documentation this package exists for.
 * The next module to implement a real endpoint adds its corresponding
 * typedef file here in the same pull request, never after the fact.
 */
const { ANALYTICS_EVENTS } = require('./analyticsEvents.js');

module.exports = { ANALYTICS_EVENTS };
