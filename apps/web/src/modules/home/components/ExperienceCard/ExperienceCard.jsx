/**
 * ExperienceCard — one entry in PopularExperiences. Localized copy is
 * looked up here (`home.experiences.items.<id>.*`), same internal-lookup
 * shape as DestinationCard/ListingCard. Rating and price render through
 * the shared `RatingStars`/`PriceTag` data-display primitives rather than
 * hand-formatting either.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Badge } from '@travelhub/ui/components/primitives';
import { RatingStars, PriceTag } from '@travelhub/ui/components/data-display';
import RouterLink from '../../../../components/RouterLink.jsx';
import styles from './ExperienceCard.module.scss';

export default function ExperienceCard({ experience }) {
  const { t, i18n } = useTranslation();
  const { locale } = useParams();
  const name = t(`home.experiences.items.${experience.id}.name`);
  const location = t(`home.experiences.items.${experience.id}.location`);
  const categoryLabel = t(`listings.type.${experience.categoryType}`);

  return (
    <RouterLink
      href={`/${locale}/search?type=${experience.categoryType}`}
      className={styles.card}
    >
      <div className={styles.media}>
        <img
          src={experience.image}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className={styles.image}
        />
        <span className={styles.badge}>
          <Badge variant="info" label={categoryLabel} size="sm" />
        </span>
      </div>
      <div className={styles.body}>
        <p className={styles.location}>{location}</p>
        <h3 className={styles.name}>{name}</h3>
        <div className={styles.meta}>
          <RatingStars
            value={experience.rating}
            reviewCount={experience.reviewCount}
            size="sm"
          />
          <span className={styles.duration}>
            {t('home.experiences.durationHours', {
              count: experience.durationHours,
            })}
          </span>
        </div>
        <PriceTag
          amount={experience.price.amount}
          currencyCode={experience.price.currencyCode}
          locale={i18n.language}
          suffix={t('home.experiences.priceSuffix')}
          size="sm"
        />
      </div>
    </RouterLink>
  );
}

ExperienceCard.propTypes = {
  experience: PropTypes.shape({
    id: PropTypes.string.isRequired,
    image: PropTypes.string.isRequired,
    categoryType: PropTypes.string.isRequired,
    durationHours: PropTypes.number.isRequired,
    rating: PropTypes.number.isRequired,
    reviewCount: PropTypes.number.isRequired,
    price: PropTypes.shape({
      amount: PropTypes.number.isRequired,
      currencyCode: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
};
