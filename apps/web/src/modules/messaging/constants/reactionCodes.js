/**
 * The fixed quick-react set, mirroring the backend's Zod enum in
 * `apps/api/src/modules/messaging/validators/messagingValidators.js`
 * (`REACTION_CODES`) — a small, closed set, not an admin-editable
 * lookup table (Phase 14 scope decision #5).
 */
export const REACTION_CODES = ['👍', '❤️', '😂', '😮', '😢', '👏'];

export default REACTION_CODES;
