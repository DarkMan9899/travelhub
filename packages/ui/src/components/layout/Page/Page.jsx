/**
 * Page — top-level per-route content wrapper. See Stack.jsx's file
 * header for why this exists outside COMPONENT_LIBRARY.md's catalog.
 *
 * Composes `Container` rather than re-implementing centering/max-width
 * (no duplicated layout logic). `title`, when given, renders the page's
 * single `<h1>` — this is a content-level heading, not a landmark; the
 * surrounding `<main>` landmark itself is `AppLayout`'s responsibility
 * (apps/web/src/layouts/AppLayout.jsx), not this component's.
 */

import PropTypes from 'prop-types';
import Container, { CONTAINER_SIZES } from '../Container/Container.jsx';
import styles from './Page.module.scss';

export default function Page({ title, containerSize, className, children }) {
  return (
    <Container
      size={containerSize}
      className={[styles.page, className].filter(Boolean).join(' ')}
    >
      {title && <h1 className={styles.title}>{title}</h1>}
      {children}
    </Container>
  );
}

Page.propTypes = {
  title: PropTypes.string,
  containerSize: PropTypes.oneOf(CONTAINER_SIZES),
  className: PropTypes.string,
  children: PropTypes.node,
};

Page.defaultProps = {
  title: undefined,
  containerSize: 'content',
  className: undefined,
  children: undefined,
};
