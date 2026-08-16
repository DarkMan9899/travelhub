/**
 * AiSearchBar (Stage 15.2) — "cheap hotels with a pool in Yerevan" ->
 * real classic-search filters, applied through `onApply` (the caller's
 * own `useSearchFilters().updateFilters`, per
 * `SearchPageContent.jsx`'s own doc comment describing itself as the
 * seam a future AI-search input would plug into). This component owns
 * only its own free-text input and the parse call — it never talks to
 * `useSearchFilters` or the URL directly, so it can be composed anywhere
 * a `{destination, categoryId, dynamicFilters}`-shaped filter update
 * makes sense.
 */

import { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { Input } from '@travelhub/ui/components/form-controls';
import { Button } from '@travelhub/ui/components/primitives';
import { Stack, Inline } from '@travelhub/ui/components/layout';
import { useParseSearchQueryMutation } from '../../mutations/useParseSearchQueryMutation.js';

export default function AiSearchBar({ onApply }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const mutation = useParseSearchQueryMutation();

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    mutation.mutate(trimmed, {
      onSuccess: (response) => {
        const {
          keyword,
          category_id: categoryId,
          amenity_ids: amenityIds = [],
        } = response.data;
        onApply(
          {
            destination: keyword,
            categoryId: categoryId ?? undefined,
            dynamicFilters:
              amenityIds.length > 0 ? { amenityIds: amenityIds.join(',') } : {},
          },
          { replace: false },
        );
      },
    });
  }

  return (
    <form onSubmit={handleSubmit} aria-label={t('search.aiSearch.ariaLabel')}>
      <Stack gap="2">
        <Inline gap="2" align="flex-end">
          <Input
            aria-label={t('search.aiSearch.inputLabel')}
            placeholder={t('search.aiSearch.placeholder')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            iconLeft={<Sparkles size={18} aria-hidden="true" />}
          />
          <Button type="submit" disabled={mutation.isPending || !query.trim()}>
            {mutation.isPending
              ? t('search.aiSearch.submitting')
              : t('search.aiSearch.submit')}
          </Button>
        </Inline>
        {mutation.isError && (
          <span role="alert">
            {mutation.error?.message ?? t('search.aiSearch.error')}
          </span>
        )}
      </Stack>
    </form>
  );
}

AiSearchBar.propTypes = {
  onApply: PropTypes.func.isRequired,
};
