/**
 * ToastContext — global client state (FRONTEND_ARCHITECTURE.md §13.3's
 * "toast queue"). `showToast` is the only thing most consumers need;
 * populated by `ToastProvider`.
 */

import { createContext, useContext } from 'react';

const ToastContext = createContext(null);

export default ToastContext;

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider.');
  }
  return context;
}
