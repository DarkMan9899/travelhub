/**
 * Root provider composition.
 *
 * Implements FRONTEND_ARCHITECTURE.md §13 (State Management Strategy):
 * composes the small set of global-client-state Context providers plus
 * TanStack React Query's QueryClientProvider — the single place all of
 * these are wired together, so app/App.jsx itself stays a thin
 * composition root.
 *
 * Application Foundation phase: adds `AuthProvider` (§11 — session
 * bootstrap, login/register/logout), `ToastProvider` and
 * `ConfirmProvider` (§13.3's toast queue, plus the confirmation-modal
 * imperative API), each introduced only now because this phase is the
 * first with real consumers for them (a login flow, and global
 * components that need to raise a toast or ask for confirmation).
 * `LocaleContext`, `CurrencyContext`, `ThemeContext` are still deferred —
 * still no consumer needing them yet.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import AuthProvider from './AuthProvider.jsx';
import ToastProvider from './ToastProvider.jsx';
import ConfirmProvider from './ConfirmProvider.jsx';

// Sensible platform-wide defaults per FRONTEND_ARCHITECTURE.md §14.2.
// Per-resource overrides (e.g. availability/pricing's staleTime: 0) are
// set at the individual query-hook level in the sprint that adds them.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

export default function AppProviders({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <AuthProvider>
          <ToastProvider>
            <ConfirmProvider>{children}</ConfirmProvider>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

AppProviders.propTypes = {
  children: PropTypes.node.isRequired,
};
