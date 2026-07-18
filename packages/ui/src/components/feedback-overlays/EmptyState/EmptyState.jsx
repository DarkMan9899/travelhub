/**
 * EmptyState — COMPONENT_LIBRARY.md Part II §4 "EmptyState".
 * Explains why a list/section has no content and offers one next action.
 */

import PropTypes from 'prop-types';
import Button from '../../primitives/Button/Button.jsx';
import styles from './EmptyState.module.scss';

export default function EmptyState({
  illustration,
  title,
  description,
  actionLabel,
  onAction,
}) {
  return (
    <div className={styles.emptyState}>
      {illustration && (
        <span className={styles.illustration} aria-hidden="true">
          {illustration}
        </span>
      )}
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}
      {actionLabel && onAction && (
        <div className={styles.action}>
          <Button variant="primary" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

EmptyState.propTypes = {
  illustration: PropTypes.node,
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  actionLabel: PropTypes.string,
  onAction: PropTypes.func,
};

EmptyState.defaultProps = {
  illustration: undefined,
  description: undefined,
  actionLabel: undefined,
  onAction: undefined,
};
