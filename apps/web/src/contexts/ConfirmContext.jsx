/**
 * ConfirmContext — the imperative "Confirmation Modal" API. `confirm()`
 * returns a Promise<boolean> so a mutation's click handler can simply
 * `if (!(await confirm({...}))) return;` rather than each call site
 * hand-rolling its own open/close modal state (COMPONENT_LIBRARY.md's
 * Modal entry: confirmation dialogs are Modal's primary use case; this
 * is the one shared imperative wrapper for that use case).
 */

import { createContext, useContext } from 'react';

const ConfirmContext = createContext(null);

export default ConfirmContext;

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider.');
  }
  return context.confirm;
}
