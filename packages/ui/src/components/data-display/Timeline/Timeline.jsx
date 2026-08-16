/**
 * Timeline — partner-authored itinerary steps
 * (`ListingItinerarySection.jsx`), typically Tours/Activities.
 */

import PropTypes from 'prop-types';
import styles from './Timeline.module.scss';

export default function Timeline({ steps, durationUnitLabel }) {
  return (
    <ol className={styles.timeline}>
      {steps.map((step, index) => (
        // eslint-disable-next-line react/no-array-index-key -- itinerary step order is the identity, steps carry no id
        <li className={styles.step} key={index}>
          <div className={styles.marker}>
            <span className={styles.markerDot} aria-hidden="true" />
            {index < steps.length - 1 && (
              <span className={styles.markerLine} aria-hidden="true" />
            )}
          </div>
          <div className={styles.content}>
            <h3 className={styles.title}>{step.title}</h3>
            {step.durationMinutes !== undefined && (
              <p className={styles.duration}>
                {step.durationMinutes} {durationUnitLabel}
              </p>
            )}
            {step.description && (
              <p className={styles.description}>{step.description}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

Timeline.propTypes = {
  steps: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string.isRequired,
      description: PropTypes.string,
      durationMinutes: PropTypes.number,
    }),
  ).isRequired,
  durationUnitLabel: PropTypes.string.isRequired,
};
