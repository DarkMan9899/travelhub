/**
 * Transport abstraction (Phase 14 scope decision #9 — "real-time ready"
 * without implementing WebSockets this phase). Every consumer that wants
 * live-ish updates for an open conversation calls `subscribeToConversation`,
 * never `setInterval` directly. Today this starts a poll and invokes the
 * callback on every tick; a future swap to a `socket.io` listener touches
 * only this one file — no consumer changes.
 *
 * Deliberately transport-agnostic about WHAT the callback does — it's the
 * caller's job to decide (e.g. refetch a React Query). This file owns
 * only the "when to check for updates" cadence.
 */

const POLL_INTERVAL_MS = 4000;

/**
 * @param {number|string} conversationId
 * @param {() => void} onTick called immediately and on every subsequent tick
 * @returns {() => void} unsubscribe
 */
export function subscribeToConversation(conversationId, onTick) {
  if (!conversationId) return () => {};

  onTick();
  const intervalId = setInterval(onTick, POLL_INTERVAL_MS);
  return () => clearInterval(intervalId);
}

export default subscribeToConversation;
