/**
 * StatCard — COMPONENT_LIBRARY.md Part II §8 "Stat Card". Headline-metric
 * tile for dashboard overview screens (Admin/Partner). `variant` colors
 * the value the same way `Badge` colors a status, never a raw hex.
 */

import PropTypes from 'prop-types';
import { TrendingUp, TrendingDown } from 'lucide-react';
import Card from '../../primitives/Card/Card.jsx';
import styles from './StatCard.module.scss';

const VARIANTS = ['neutral', 'success', 'warning', 'danger', 'info'];

export default function StatCard({
  label,
  value = undefined,
  variant = 'neutral',
  trend = undefined,
  comparisonPeriodLabel = undefined,
  isLoading = false,
}) {
  const ariaLabel = trend
    ? `${label}: ${value}, ${trend.direction === 'up' ? '+' : '-'}${trend.percent}%${
        comparisonPeriodLabel ? ` ${comparisonPeriodLabel}` : ''
      }`
    : `${label}: ${value}`;

  return (
    <Card as="div" padding="lg" className={styles.statCard}>
      {isLoading ? (
        <div className={styles.skeleton} aria-hidden="true" />
      ) : (
        <div aria-label={ariaLabel}>
          <p className={styles.label}>{label}</p>
          <p className={[styles.value, styles[`value--${variant}`]].join(' ')}>
            {value}
          </p>
          {trend && (
            <p
              className={[
                styles.trend,
                trend.direction === 'up'
                  ? styles['trend--up']
                  : styles['trend--down'],
              ].join(' ')}
            >
              {trend.direction === 'up' ? (
                <TrendingUp aria-hidden="true" focusable="false" />
              ) : (
                <TrendingDown aria-hidden="true" focusable="false" />
              )}
              <span>
                {trend.percent}%
                {comparisonPeriodLabel ? ` ${comparisonPeriodLabel}` : ''}
              </span>
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

StatCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  variant: PropTypes.oneOf(VARIANTS),
  trend: PropTypes.shape({
    direction: PropTypes.oneOf(['up', 'down']).isRequired,
    percent: PropTypes.number.isRequired,
  }),
  comparisonPeriodLabel: PropTypes.string,
  isLoading: PropTypes.bool,
};
