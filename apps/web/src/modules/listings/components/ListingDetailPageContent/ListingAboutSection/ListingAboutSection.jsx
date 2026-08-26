/**
 * ListingAboutSection — Phase 18 (Premium Listing Detail): the listing's
 * partner-authored description, given a real section of its own for the
 * first time (previously rendered nowhere on the page despite existing
 * on every listing translation). Long descriptions collapse behind a
 * "Show more" toggle rather than either truncating silently or forcing
 * every visitor to scroll past several paragraphs before reaching
 * Amenities/Availability/Pricing.
 */

import { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Button } from '@desavii/ui/components/primitives';
import { Section, Stack } from '@desavii/ui/components/layout';
import styles from './ListingAboutSection.module.scss';

const COLLAPSE_LENGTH = 480;

export default function ListingAboutSection({ description = null, sectionId }) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!description) return null;

  const isLong = description.length > COLLAPSE_LENGTH;
  const showFull = isExpanded || !isLong;

  return (
    <Section spacing="none" aria-label={t('pages.listingDetail.about.heading')}>
      <Stack gap="3">
        <h2 id={sectionId}>{t('pages.listingDetail.about.heading')}</h2>
        <p
          className={[styles.text, !showFull && styles.clamped]
            .filter(Boolean)
            .join(' ')}
        >
          {description}
        </p>
        {isLong && (
          <Button
            variant="ghost"
            size="sm"
            className={styles.toggle}
            onClick={() => setIsExpanded((current) => !current)}
          >
            {isExpanded
              ? t('pages.listingDetail.about.showLess')
              : t('pages.listingDetail.about.showMore')}
          </Button>
        )}
      </Stack>
    </Section>
  );
}

ListingAboutSection.propTypes = {
  description: PropTypes.string,
  sectionId: PropTypes.string.isRequired,
};
