/**
 * CompaniesDirectoryPageContent — `/:locale/companies` (Phase 10
 * redesign). Real `GET /partners` results — the Companies/Partners
 * public directory the audit confirmed was completely missing before
 * this phase. No filters (unlike Search) — the directory is small
 * enough that a filter bar would be premature; "Load more", matching
 * the established infinite-scroll-button pattern
 * (`Search`/`Listings`/`Bookings`) over the new `Pagination` primitive,
 * since a cursor-paginated backend has no natural "jump to page N".
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Section } from '@desavii/ui/components/layout';
import {
  Skeleton,
  EmptyState,
  ErrorState,
} from '@desavii/ui/components/feedback-overlays';
import { Button } from '@desavii/ui/components/primitives';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import useSeo from '../../../../seo/useSeo.js';
import { buildBreadcrumbListSchema } from '../../../../seo/structuredData.js';
import { useCompaniesQuery } from '../../queries/useCompaniesQuery.js';
import CompanyCard from '../CompanyCard/CompanyCard.jsx';
import styles from './CompaniesDirectoryPageContent.module.scss';

const SKELETON_COUNT = 6;

export default function CompaniesDirectoryPageContent() {
  const { t } = useTranslation();
  const { locale } = useParams();
  const {
    data,
    isPending,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useCompaniesQuery();

  const companies = useMemo(
    () => data?.pages.flatMap((page) => page.results) ?? [],
    [data],
  );

  const breadcrumbItems = [
    { label: t('nav.home'), href: `/${locale}` },
    { label: t('companies.directory.title'), href: `/${locale}/companies` },
  ];

  useSeo({
    title: t('seo.companies.title'),
    description: t('seo.companies.description'),
    locale,
    path: 'companies',
    jsonLd: [buildBreadcrumbListSchema(breadcrumbItems)],
  });

  return (
    <Section spacing="default">
      <PageHeader
        title={t('companies.directory.title')}
        breadcrumbs={breadcrumbItems}
      />

      {isPending && (
        <div className={styles.grid}>
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <Skeleton key={index} variant="rect" height={260} />
          ))}
        </div>
      )}

      {isError && (
        <ErrorState
          title={t('companies.directory.error.title')}
          description={t('companies.directory.error.description')}
          retryLabel={t('companies.directory.error.retry')}
          onRetry={refetch}
        />
      )}

      {!isPending && !isError && companies.length === 0 && (
        <EmptyState
          title={t('companies.directory.empty.title')}
          description={t('companies.directory.empty.description')}
        />
      )}

      {!isPending && !isError && companies.length > 0 && (
        <div>
          <div className={styles.grid}>
            {companies.map((company) => (
              <CompanyCard key={company.id} company={company} />
            ))}
          </div>
          {hasNextPage && (
            <div className={styles.loadMore}>
              <Button
                variant="secondary"
                onClick={fetchNextPage}
                loading={isFetchingNextPage}
              >
                {t('companies.directory.loadMore')}
              </Button>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}
