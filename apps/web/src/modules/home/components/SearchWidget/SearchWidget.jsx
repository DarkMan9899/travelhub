/**
 * SearchWidget — the homepage's search bar. Submitting navigates to the
 * existing `/:locale/search` route with the chosen values preserved as
 * URL search params (FRONTEND_ARCHITECTURE.md's "search filters live in
 * URL search params, must be shareable/bookmarkable" rule) — it does not
 * implement search itself; `SearchPageContent` is still a placeholder
 * this phase, per the brief's explicit scope limit.
 *
 * Destination and Category are both backed by real data: destination
 * suggestions via `DestinationAutocomplete` (`GET /search/suggestions`),
 * categories via the same `useCategoriesQuery` (`GET /search/categories`)
 * the Categories section uses, so this dropdown never drifts out of sync
 * with what's actually browsable.
 *
 * P1.1 (Master Roadmap): dates used to be a pair of plain free-text
 * `Input` fields under the stale `checkIn`/`checkOut` param names —
 * `modules/search/schemas/searchParams.js` never read either name (and
 * even if it had, free text isn't a validatable date). Now a single
 * real `DatePicker` (range mode, the same component/pattern
 * `ListingReservationWidget` already uses), emitting `dateFrom`/`dateTo`
 * — the exact param names both `searchParams.js` and the backend's
 * `GET /search` validator expect, so a date range picked here now
 * actually reaches search results, not just the URL bar.
 *
 * Fields intentionally render with no visible per-field label (an
 * `aria-label`/`ariaLabel` carries the same text for assistive tech
 * instead) — a compact single-row bar reads as an integrated extension
 * of the Hero rather than a separate, dominant form block; the icon +
 * placeholder in each segment communicates purpose visually.
 */

import { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { Select, DatePicker } from '@travelhub/ui/components/form-controls';
import { Button } from '@travelhub/ui/components/primitives';
import { Inline } from '@travelhub/ui/components/layout';
import { useCategoriesQuery } from '../../../search/index.js';
import DestinationAutocomplete from '../DestinationAutocomplete/DestinationAutocomplete.jsx';
import styles from './SearchWidget.module.scss';

const GUEST_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function SearchWidget({ className = undefined }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { locale } = useParams();
  const { data: categories = [] } = useCategoriesQuery({ locale });

  const [destination, setDestination] = useState('');
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [guests, setGuests] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const categoryOptions = [
    { value: '', label: t('home.search.categoryAll') },
    ...categories.map((cat) => ({ value: String(cat.id), label: cat.name })),
  ];

  const guestOptions = GUEST_COUNTS.map((count) => ({
    value: String(count),
    label: t('home.search.guestsCount', { count }),
  }));
  const today = new Date().toISOString().slice(0, 10);

  function handleSubmit(event) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (destination) params.set('destination', destination);
    if (dateRange.start && dateRange.end) {
      params.set('dateFrom', dateRange.start);
      params.set('dateTo', dateRange.end);
    }
    if (guests) params.set('guests', guests);
    if (categoryId) params.set('categoryId', categoryId);

    const query = params.toString();
    navigate(`/${locale}/search${query ? `?${query}` : ''}`);
  }

  return (
    <form
      className={[styles.widget, className].filter(Boolean).join(' ')}
      onSubmit={handleSubmit}
    >
      <Inline gap="0" align="stretch" className={styles.fields}>
        <div className={styles.field}>
          <DestinationAutocomplete
            aria-label={t('home.search.destinationLabel')}
            placeholder={t('home.search.destinationPlaceholder')}
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
            iconLeft={<MapPin size={18} aria-hidden="true" />}
          />
        </div>
        <div className={styles.field}>
          <DatePicker
            mode="range"
            ariaLabel={t('home.search.datesLabel')}
            placeholder={t('home.search.datePlaceholder')}
            value={dateRange}
            onChange={setDateRange}
            minDate={today}
            locale={i18n.language}
            previousMonthLabel={t(
              'partner.listingWizard.datePicker.previousMonth',
            )}
            nextMonthLabel={t('partner.listingWizard.datePicker.nextMonth')}
          />
        </div>
        <div className={styles.field}>
          <Select
            ariaLabel={t('home.search.guestsLabel')}
            placeholder={t('home.search.guestsPlaceholder')}
            options={guestOptions}
            value={guests}
            onChange={setGuests}
          />
        </div>
        <div className={styles.field}>
          <Select
            ariaLabel={t('home.search.categoryLabel')}
            placeholder={t('home.search.categoryAll')}
            options={categoryOptions}
            value={categoryId}
            onChange={setCategoryId}
          />
        </div>
        <div className={styles.submitWrapper}>
          <Button type="submit" variant="primary" size="lg" fullWidth>
            {t('home.search.submit')}
          </Button>
        </div>
      </Inline>
    </form>
  );
}

SearchWidget.propTypes = {
  className: PropTypes.string,
};
