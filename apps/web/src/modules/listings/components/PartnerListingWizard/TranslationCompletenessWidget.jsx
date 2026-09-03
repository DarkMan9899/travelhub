/**
 * TranslationCompletenessWidget — Review & Publish step (2026 Partner
 * Workspace redesign, Sprint 3 closeout). Shows what's actually authored
 * per locale (HY/RU/EN), computed client-side from the same `listing`
 * object `ReviewStep` already holds (`computeTranslationCompleteness`,
 * pure/tested) — no new query, no fallback content.
 *
 * Deliberately separate from `ListingCompletenessWidget` (the server-
 * computed REQUIRED-to-publish score): this widget is purely informational
 * and never affects `usePublishListingMutation`/the publish button —
 * publishing only ever needs one locale's translation (existing rule,
 * unchanged), so a locale sitting at 'missing' here is expected, not an
 * error state.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Circle, MinusCircle } from 'lucide-react';
import { SUPPORTED_LOCALES } from '../../../../translations/i18n.js';
import computeTranslationCompleteness from '../../utils/translationCompleteness.js';
import styles from './TranslationCompletenessWidget.module.scss';

const STATUS_ICON = {
  complete: CheckCircle2,
  partial: MinusCircle,
  missing: Circle,
};

export default function TranslationCompletenessWidget({ listing }) {
  const { t } = useTranslation();

  return (
    <div className={styles.widget}>
      <span className={styles.label}>
        {t('partner.listingWizard.translationCompleteness.title')}
      </span>
      <p className={styles.hint}>
        {t('partner.listingWizard.translationCompleteness.hint')}
      </p>
      <ul className={styles.list}>
        {SUPPORTED_LOCALES.map((locale) => {
          const { status, presentCount, totalFields } =
            computeTranslationCompleteness(listing, locale);
          const Icon = STATUS_ICON[status];
          return (
            <li
              key={locale}
              className={[styles.row, styles[`row--${status}`]].join(' ')}
            >
              <Icon aria-hidden="true" focusable="false" size={16} />
              <span className={styles.localeName}>
                {t(`partner.listingWizard.contentLocale.${locale}`)}
              </span>
              <span className={styles.status}>
                {t(
                  `partner.listingWizard.translationCompleteness.status.${status}`,
                )}
              </span>
              <span className={styles.fraction}>
                {t('partner.listingWizard.translationCompleteness.fraction', {
                  present: presentCount,
                  total: totalFields,
                })}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const translationShape = PropTypes.shape({
  language_code: PropTypes.string.isRequired,
  title: PropTypes.string,
  summary: PropTypes.string,
  description: PropTypes.string,
});

const localizedRowShape = PropTypes.shape({
  language_code: PropTypes.string.isRequired,
});

TranslationCompletenessWidget.propTypes = {
  listing: PropTypes.shape({
    translations: PropTypes.arrayOf(translationShape).isRequired,
    highlights: PropTypes.arrayOf(localizedRowShape),
    included_items: PropTypes.arrayOf(localizedRowShape),
    faqs: PropTypes.arrayOf(localizedRowShape),
    itinerary_steps: PropTypes.arrayOf(localizedRowShape),
  }).isRequired,
};
