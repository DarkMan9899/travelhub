/**
 * PartnerListingsPageContent — `/:locale/partner/listings` (Partner
 * Dashboard: Listings Management). Orchestrator: owns keyword/status/sort
 * filter state and the `useMyListingsQuery` infinite query, mirroring
 * `search`'s `SearchPageContent` / `bookings`'s `BookingsPageContent`
 * split (this file owns state, `PartnerListingsList` is presentational).
 *
 * Filter state is local `useState`, not URL-synced (unlike `search`'s
 * `useSearchFilters`) — a deliberate scope simplification: this is a
 * partner's own private management view, not a shareable/bookmarkable
 * public search, so the URL-sync machinery `useSearchFilters` exists for
 * isn't worth duplicating here.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { Section, Stack, Inline } from '@desavii/ui/components/layout';
import { Input, Select } from '@desavii/ui/components/form-controls';
import { Button } from '@desavii/ui/components/primitives';
import { Search } from 'lucide-react';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import { usePartnerContext } from '../../../../contexts/PartnerContext.jsx';
import {
  useMyListingsQuery,
  LISTING_STATUS_KEYS,
} from '../../../listings/index.js';
import {
  SORT_KEYS,
  SORT_OPTION_META,
  DEFAULT_SORT_KEY,
} from '../../../../constants/sortOptions.js';
import PartnerListingsList from '../PartnerListingsList/PartnerListingsList.jsx';

const KEYWORD_DEBOUNCE_MS = 400;

export default function PartnerListingsPageContent() {
  const { t } = useTranslation();
  const { locale } = useParams();
  const navigate = useNavigate();
  const { activePartnerId } = usePartnerContext();

  const [keywordText, setKeywordText] = useState('');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState(DEFAULT_SORT_KEY);

  useEffect(() => {
    const timeout = setTimeout(
      () => setKeyword(keywordText),
      KEYWORD_DEBOUNCE_MS,
    );
    return () => clearTimeout(timeout);
  }, [keywordText]);

  const {
    data,
    isPending,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMyListingsQuery({ partnerId: activePartnerId, status, keyword, sort });

  const listings = useMemo(
    () => data?.pages.flatMap((page) => page.results) ?? [],
    [data],
  );

  const statusOptions = [
    { value: '', label: t('partner.listings.filters.statusAll') },
    ...LISTING_STATUS_KEYS.map((code) => ({
      value: code,
      label: t(`listings.status.${code}`),
    })),
  ];

  const sortOptions = SORT_KEYS.filter(
    (key) => !SORT_OPTION_META[key].requiresKeyword || keyword,
  ).map((key) => ({ value: key, label: t(`search.filters.sort.${key}`) }));

  return (
    <Section spacing="default">
      <PageHeader
        title={t('partner.listings.heading')}
        breadcrumbs={[
          { label: t('nav.home'), href: `/${locale}` },
          { label: t('partner.nav.dashboard'), href: `/${locale}/partner` },
          {
            label: t('partner.listings.heading'),
            href: `/${locale}/partner/listings`,
          },
        ]}
        actions={
          <Button
            variant="primary"
            onClick={() => navigate(`/${locale}/partner/listings/new`)}
          >
            {t('partner.listings.create')}
          </Button>
        }
      />

      <Stack gap="4">
        <Inline gap="3" wrap>
          <Input
            aria-label={t('partner.listings.filters.keywordLabel')}
            placeholder={t('partner.listings.filters.keywordPlaceholder')}
            value={keywordText}
            onChange={(event) => setKeywordText(event.target.value)}
            iconLeft={<Search size={18} aria-hidden="true" />}
          />
          <Select
            ariaLabel={t('partner.listings.filters.statusLabel')}
            options={statusOptions}
            value={status}
            onChange={(value) => setStatus(value)}
          />
          <Select
            ariaLabel={t('partner.listings.filters.sortLabel')}
            options={sortOptions}
            value={sort}
            onChange={(value) => setSort(value)}
          />
        </Inline>

        <PartnerListingsList
          listings={listings}
          isPending={isPending}
          isError={isError}
          onRetry={refetch}
          hasNextPage={Boolean(hasNextPage)}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={fetchNextPage}
        />
      </Stack>
    </Section>
  );
}
