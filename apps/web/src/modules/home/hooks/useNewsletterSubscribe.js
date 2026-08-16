/**
 * useNewsletterSubscribe — client-only "subscribe" handler. No newsletter
 * API exists this phase (frontend-only scope; inventing one is out of
 * bounds) — this manages a local success/error-free acknowledgment only,
 * never a real subscription. Documented as a placeholder in the phase
 * report per the brief.
 */

import { useCallback, useState } from 'react';

export default function useNewsletterSubscribe() {
  const [status, setStatus] = useState('idle'); // idle | success

  const subscribe = useCallback(() => {
    setStatus('success');
  }, []);

  return { status, subscribe };
}
