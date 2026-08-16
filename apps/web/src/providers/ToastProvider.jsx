/**
 * ToastProvider — orchestrates the ephemeral notification queue
 * (FRONTEND_ARCHITECTURE.md §26): stacking, auto-dismiss timing, and the
 * imperative `showToast(...)` API are this application-level concern;
 * `@travelhub/ui`'s `Toast` stays pure presentation (see that
 * component's file header).
 *
 * Portal'd to `document.body` so it renders above every layout
 * regardless of where `useToast()` is called from, fixed-positioned at
 * `$z-toast` (COMPONENT_LIBRARY.md Part I's centrally-managed z-index
 * scale — never a raw number here).
 */

import { useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Toast } from '@travelhub/ui/components/feedback-overlays';
import ToastContext from '../contexts/ToastContext.jsx';
import styles from './ToastProvider.module.scss';

const DEFAULT_DURATION_MS = 5000;
let nextId = 0;

export default function ToastProvider({ children }) {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message, { variant = 'info', duration = DEFAULT_DURATION_MS } = {}) => {
      nextId += 1;
      const id = nextId;
      setToasts((current) => [...current, { id, message, variant }]);
      if (duration > 0) {
        setTimeout(() => dismissToast(id), duration);
      }
      return id;
    },
    [dismissToast],
  );

  const value = useMemo(
    () => ({ showToast, dismissToast }),
    [showToast, dismissToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div
          className={styles.viewport}
          role="region"
          aria-label={t('a11y.notifications')}
        >
          {toasts.map((toast) => (
            <Toast
              key={toast.id}
              variant={toast.variant}
              message={toast.message}
              onDismiss={() => dismissToast(toast.id)}
            />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

ToastProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
