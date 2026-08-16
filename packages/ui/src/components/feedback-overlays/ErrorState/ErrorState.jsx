/**
 * ErrorState — the platform's one "request failed, let the user retry"
 * surface, mirroring `EmptyState`'s shape (title + optional description
 * + optional action) rather than re-implementing it per page.
 */

import PropTypes from 'prop-types';
import { AlertTriangle } from 'lucide-react';
import Button from '../../primitives/Button/Button.jsx';
import styles from './ErrorState.module.scss';

export default function ErrorState({
  title,
  description = undefined,
  retryLabel = undefined,
  onRetry = undefined,
}) {
  return (
    <div className={styles.errorState} role="alert">
      <AlertTriangle
        className={styles.icon}
        aria-hidden="true"
        focusable="false"
      />
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}
      {retryLabel && onRetry && (
        <div className={styles.action}>
          <Button variant="secondary" onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

ErrorState.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  retryLabel: PropTypes.string,
  onRetry: PropTypes.func,
};
