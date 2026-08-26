/**
 * TestimonialCard — one placeholder testimonial. `Avatar` renders
 * initials (no photo asset for placeholder people), `RatingStars` reused
 * rather than hand-drawn stars.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Quote } from 'lucide-react';
import { Avatar } from '@desavii/ui/components/primitives';
import { RatingStars } from '@desavii/ui/components/data-display';
import styles from './TestimonialCard.module.scss';

export default function TestimonialCard({ testimonial }) {
  const { t } = useTranslation();
  const quote = t(`home.testimonials.items.${testimonial.id}.quote`);
  const name = t(`home.testimonials.items.${testimonial.id}.name`);
  const role = t(`home.testimonials.items.${testimonial.id}.role`);

  return (
    <figure className={styles.card}>
      <Quote className={styles.quoteGlyph} aria-hidden="true" />
      <RatingStars value={testimonial.rating} size="sm" />
      <blockquote className={styles.quote}>
        <p>&ldquo;{quote}&rdquo;</p>
      </blockquote>
      <figcaption className={styles.author}>
        <Avatar name={name} size="md" />
        <div>
          <p className={styles.name}>{name}</p>
          <p className={styles.role}>{role}</p>
        </div>
      </figcaption>
    </figure>
  );
}

TestimonialCard.propTypes = {
  testimonial: PropTypes.shape({
    id: PropTypes.string.isRequired,
    rating: PropTypes.number.isRequired,
  }).isRequired,
};
