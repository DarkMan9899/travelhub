/**
 * Minimal 404 fallback (an invalid/missing locale segment, or an
 * unmatched path — FRONTEND_ARCHITECTURE.md §4.5/§4.1). The full,
 * designed 404 experience (COMPONENT_LIBRARY.md's "404 Page" component
 * — search bar, illustration, localized copy) is built in a future
 * sprint; this is the structural fallback proving the router's
 * not-found path is wired.
 */
export default function NotFoundPage() {
  return (
    <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
      <h1>404</h1>
      <p>Page not found.</p>
      <a href="/hy">Back to home</a>
    </div>
  );
}
