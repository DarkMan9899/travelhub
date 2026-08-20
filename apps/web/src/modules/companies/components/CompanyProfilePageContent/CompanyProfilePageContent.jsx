/**
 * CompanyProfilePageContent — `/:locale/companies/:slug` (Phase 10
 * redesign). Real `GET /partners/:slug` data (logo/cover/description/
 * contact — Sprint 5 columns no UI had ever surfaced) plus a "Listings"
 * section reusing `search`'s own `useSearchListingsQuery`/
 * `SearchResultCard` filtered by `partnerId`, exactly like
 * `RelatedListings` reuses them filtered by `categoryId` — no new
 * listings-fetching path invented; each listing's rating (Phase 12's
 * Reviews module) already shows up for free via that same
 * `SearchResultCard` reuse. No separate partner-level aggregate rating —
 * that would mean averaging across an owner's entire portfolio, a
 * different metric this phase doesn't build.
 *
 * Same two-distinct-error-states convention as
 * `ListingDetailPageContent`: a genuine 404 (unapproved/deleted/
 * nonexistent slug) renders the shared `errors.notFound.*` `EmptyState`;
 * any other failure gets the generic retryable `ErrorState`.
 */

import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { Globe, Mail, Phone, ShieldCheck } from 'lucide-react';
import {
  Skeleton,
  ErrorState,
  EmptyState,
} from '@travelhub/ui/components/feedback-overlays';
import { Section, Stack, Inline } from '@travelhub/ui/components/layout';
import { Icon } from '@travelhub/ui/components/primitives';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import useSeo from '../../../../seo/useSeo.js';
import { buildBreadcrumbListSchema } from '../../../../seo/structuredData.js';
import getLocalizedTranslation from '../../../listings/utils/getLocalizedTranslation.js';
import { useCompanyQuery } from '../../queries/useCompanyQuery.js';
import {
  useSearchListingsQuery,
  SearchResultCard,
} from '../../../search/index.js';
import styles from './CompanyProfilePageContent.module.scss';

// Brand names, not translated content — same convention as leaving
// "Facebook"/"Instagram" untranslated on `PartnerProfilePageContent`'s
// own edit form (`partner.profile.social.*`'s own strings are the
// identical brand names in every locale, for the same reason).
const SOCIAL_PLATFORM_LABELS = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  x: 'X (Twitter)',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
};

export default function CompanyProfilePageContent() {
  const { t } = useTranslation();
  const { locale, slug } = useParams();
  const navigate = useNavigate();

  const {
    data: company,
    isPending,
    isError,
    error,
    refetch,
  } = useCompanyQuery(slug);

  const { data: listingsData } = useSearchListingsQuery(
    { partnerId: company?.id },
    { locale },
  );
  const listings = listingsData?.pages[0]?.results ?? [];

  // P1.3 (Master Roadmap): `description` moved from a flat column to
  // `partner_translations` — resolved for the current locale via the
  // same `getLocalizedTranslation` util listings use, falling back to
  // the "any available" flat `description` (Companies-directory-card
  // fallback — see `mysqlPartnerRepository.js`'s own comment) only if
  // no translation matched at all.
  const description =
    getLocalizedTranslation(company?.translations, locale)?.description ||
    company?.description ||
    '';
  const socialLinks = Object.entries(company?.social_links ?? {}).filter(
    ([, url]) => url,
  );

  const canonicalPath = `companies/${slug}`;
  const breadcrumbItems = company
    ? [
        { label: t('nav.home'), href: `/${locale}` },
        { label: t('companies.directory.title'), href: `/${locale}/companies` },
        { label: company.display_name, href: `/${locale}/${canonicalPath}` },
      ]
    : [];

  useSeo({
    title: company ? `${company.display_name} | ${t('app.name')}` : undefined,
    description: description || t('seo.companies.description'),
    locale,
    path: company ? canonicalPath : undefined,
    noindex: !company,
    skipHreflang: !company,
    image: company?.logo_url || undefined,
    jsonLd: company ? [buildBreadcrumbListSchema(breadcrumbItems)] : undefined,
  });

  if (isPending) {
    return (
      <Stack
        gap="6"
        aria-busy="true"
        aria-label={t('companies.profile.loading')}
      >
        <Skeleton variant="text" width="40%" height={32} />
        <Skeleton variant="rect" height={240} />
        <Skeleton variant="rect" height={120} />
      </Stack>
    );
  }

  if (isError) {
    if (error.status === 404) {
      return (
        <EmptyState
          title={t('errors.notFound.title')}
          description={t('errors.notFound.description')}
          actionLabel={t('errors.notFound.action')}
          onAction={() => navigate(`/${locale}`)}
        />
      );
    }
    return (
      <ErrorState
        title={t('companies.profile.errorTitle')}
        retryLabel={t('companies.profile.retry')}
        onRetry={refetch}
      />
    );
  }

  return (
    <Stack gap="6">
      <PageHeader title={company.display_name} breadcrumbs={breadcrumbItems} />

      <div className={styles.hero}>
        {company.cover_url && (
          <img
            src={company.cover_url}
            alt=""
            className={styles.coverImage}
            loading="lazy"
          />
        )}
        <div className={styles.heroBody}>
          {company.logo_url && (
            <img src={company.logo_url} alt="" className={styles.logo} />
          )}
          <div>
            {/* PageHeader above already renders this page's one `<h1>`
                (its own file header: "a page composes this once, never
                its own separate heading") — this is a styled restatement
                inside the hero visual, not a second heading. */}
            <Inline gap="2" align="center">
              <p className={styles.name}>{company.display_name}</p>
              {company.is_verified && (
                <span className={styles.verifiedBadge}>
                  <Icon icon={ShieldCheck} size="md" />
                  {t('companies.card.verified')}
                </span>
              )}
            </Inline>
            {description && <p className={styles.description}>{description}</p>}
          </div>
        </div>
      </div>

      {(company.email || company.phone || company.website) && (
        <Inline gap="6" className={styles.contactRow}>
          {company.email && (
            <a href={`mailto:${company.email}`} className={styles.contactLink}>
              <Icon icon={Mail} size="sm" />
              {company.email}
            </a>
          )}
          {company.phone && (
            <a href={`tel:${company.phone}`} className={styles.contactLink}>
              <Icon icon={Phone} size="sm" />
              {company.phone}
            </a>
          )}
          {company.website && (
            <a
              href={company.website}
              target="_blank"
              rel="noreferrer"
              className={styles.contactLink}
            >
              <Icon icon={Globe} size="sm" />
              {company.website}
            </a>
          )}
        </Inline>
      )}

      {socialLinks.length > 0 && (
        <Inline gap="6" className={styles.contactRow}>
          {socialLinks.map(([platform, url]) => (
            <a
              key={platform}
              href={url}
              target="_blank"
              rel="noreferrer"
              className={styles.contactLink}
            >
              <Icon icon={Globe} size="sm" />
              {SOCIAL_PLATFORM_LABELS[platform] ?? platform}
            </a>
          ))}
        </Inline>
      )}

      {listings.length > 0 && (
        <Section
          spacing="none"
          aria-label={t('companies.profile.listingsHeading')}
        >
          <h2>{t('companies.profile.listingsHeading')}</h2>
          <div className={styles.listingsGrid}>
            {listings.map((listing) => (
              <SearchResultCard key={listing.id} result={listing} />
            ))}
          </div>
        </Section>
      )}
    </Stack>
  );
}
