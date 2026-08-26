/**
 * "Last used workspace" persistence (Phase 10 redesign) — a signed-in
 * user who owns/works for a partner org can act as either a Customer or
 * a Partner; this remembers which one they last chose so a later login
 * lands them back where they left off, per the redesign's role-aware
 * login requirement. Plain `localStorage`, not a context — read only at
 * the two moments that matter (post-login redirect, workspace switch),
 * never subscribed to for live updates.
 *
 * Desavii brand rename: the storage key moved from `travelhub:` to
 * `desavii:`. `getLastWorkspace` falls back to the old key when the new
 * one is unset so an existing user's saved preference isn't silently
 * lost by the rename — every write always uses the new key only.
 */

const STORAGE_KEY = 'desavii:lastWorkspace';
const LEGACY_STORAGE_KEY = 'travelhub:lastWorkspace';
const WORKSPACES = ['customer', 'partner'];

export function getLastWorkspace() {
  try {
    const value =
      window.localStorage.getItem(STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_STORAGE_KEY);
    return WORKSPACES.includes(value) ? value : null;
  } catch {
    // Storage unavailable (private browsing, disabled cookies) — treat as
    // "no preference recorded" rather than throwing.
    return null;
  }
}

export function setLastWorkspace(workspace) {
  if (!WORKSPACES.includes(workspace)) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, workspace);
  } catch {
    // Ignore — losing this preference is not worth failing the action
    // that triggered it (a workspace switch/login should still succeed).
  }
}

export default { getLastWorkspace, setLastWorkspace };
