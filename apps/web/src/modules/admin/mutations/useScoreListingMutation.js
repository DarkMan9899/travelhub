/**
 * `useScoreListingMutation` — wraps `POST /ai/admin/moderation/:listingId/score`
 * (Stage 15.6: Admin AI). One shared mutation instance drives every row's
 * "Score" button in `AdminAiModerationPageContent`; per-row pending state
 * is derived by comparing `mutation.variables` against the row, matching
 * `AdminListingModerationPageContent`'s established pattern for a single
 * mutation shared across a table.
 */

import { useMutation } from '@tanstack/react-query';
import { scoreListing } from '../../../api/ai.js';

export function useScoreListingMutation() {
  return useMutation({
    mutationFn: (listingId) => scoreListing(listingId),
  });
}

export default useScoreListingMutation;
