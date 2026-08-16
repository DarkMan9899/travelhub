/** `useParseSearchQueryMutation` — wraps `POST /ai/search/parse`. */

import { useMutation } from '@tanstack/react-query';
import { parseSearchQuery } from '../../../api/ai.js';

export function useParseSearchQueryMutation() {
  return useMutation({
    mutationFn: (query) => parseSearchQuery(query),
  });
}

export default useParseSearchQueryMutation;
