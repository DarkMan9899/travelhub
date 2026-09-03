/**
 * Application-level error boundary.
 * Implements FRONTEND_ARCHITECTURE.md §27.1.3: catches unhandled render
 * exceptions and renders a minimal fallback. The full ErrorLayout / 500
 * page treatment (COMPONENT_LIBRARY.md's "500 Page" component) is built
 * in a future sprint; this sprint provides the catching mechanism itself
 * so no future page can ship without one already in place above it.
 */

import { Component } from 'react';
import PropTypes from 'prop-types';
// The i18next singleton, not the `useTranslation` hook — a class
// component (this one, since React error boundaries can only be classes)
// can't call hooks. `i18n.t()` still reads the live, currently-active
// language at call time, the same as the hook would.
import i18n from '../translations/i18n.js';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // FRONTEND_ARCHITECTURE.md §36: real monitoring-pipeline reporting is
    // wired in a future sprint. For now, fail loudly in dev, silently in
    // build output — never silently swallowed.
    // eslint-disable-next-line no-console
    console.error('Unhandled render error caught by ErrorBoundary:', {
      error,
      info,
    });
  }

  render() {
    const { hasError } = this.state;
    const { children } = this.props;

    if (hasError) {
      return (
        <div role="alert" style={{ padding: '2rem', textAlign: 'center' }}>
          <h1>{i18n.t('errors.boundary.title')}</h1>
          <p>{i18n.t('errors.boundary.description')}</p>
        </div>
      );
    }
    return children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
};
