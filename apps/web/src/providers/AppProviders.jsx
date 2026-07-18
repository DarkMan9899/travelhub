/**
 * Root provider composition.
 *
 * Implements FRONTEND_ARCHITECTURE.md §13 (State Management Strategy):
 * composes the small set of global-client-state Context providers plus
 * TanStack React Query's QueryClientProvider — the single place all of
 * these are wired together, so app/App.jsx itself stays a thin
 * composition root.
 *
 * Sprint 1 scope: QueryClientProvider + BrowserRouter only. AuthContext,
 * LocaleContext, CurrencyContext, ThemeContext, ToastContext (§13.3) are
 * NOT added yet — there is no session, no user-facing content, and no
 * mutation flow in this sprint that needs them. Adding an empty Context
 * "for later" would violate FRONTEND_ARCHITECTURE.md §1's server-state-
 * vs-client-state discipline by inviting premature, undirected state
 * design — each Context is introduced in the sprint that has a real
 * consumer for it.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import PropTypes from 'prop-types';

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
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
}

AppProviders.propTypes = {
  children: PropTypes.node.isRequired,
};
