/**
 * Resolves a display name for a conversation's `participants[]` entry
 * (`GET /messaging/conversations*`'s `first_name`/`last_name` — may be
 * absent for a `messaging.view_all` reader's own bare-conversation
 * shape). Falls back to a generic "User #id" rather than rendering
 * blank/undefined, matching this codebase's "never render nothing where
 * the user expects a name" convention.
 */

export function getParticipantDisplayName(participant, t) {
  if (!participant) return t('messaging.participant.unknown');
  const fullName = [participant.first_name, participant.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  return (
    fullName || t('messaging.participant.fallback', { id: participant.user_id })
  );
}

/** Comma-joined display names for a conversation's other participants. */
export function getConversationTitle(participants, t) {
  if (!participants || participants.length === 0) {
    return t('messaging.participant.unknown');
  }
  return participants
    .map((participant) => getParticipantDisplayName(participant, t))
    .join(', ');
}

export default getParticipantDisplayName;
