/**
 * ConfirmProvider — renders the single, shared confirmation `Modal`
 * (see `contexts/ConfirmContext.jsx`'s file header for the API shape).
 * Exactly one confirmation can be pending at a time by design — a
 * second `confirm()` call while one is open replaces it rather than
 * stacking, since a stacked pair of confirmations is never a real
 * product need here.
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Modal } from '@desavii/ui/components/feedback-overlays';
import { Button } from '@desavii/ui/components/primitives';
import { Inline } from '@desavii/ui/components/layout';
import ConfirmContext from '../contexts/ConfirmContext.jsx';

export default function ConfirmProvider({ children }) {
  const { t } = useTranslation();
  const [request, setRequest] = useState(null);
  const resolverRef = useRef(null);

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        resolverRef.current = resolve;
        setRequest(options);
      }),
    [],
  );

  const settle = useCallback((result) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setRequest(null);
  }, []);

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {request && (
        <Modal
          isOpen
          onClose={() => settle(false)}
          title={request.title}
          ariaLabel={t('common.dialog')}
          closeLabel={t('common.close')}
          size="sm"
          footer={
            <Inline gap="3" justify="flex-end">
              <Button variant="ghost" onClick={() => settle(false)}>
                {request.cancelLabel ?? t('common.cancel')}
              </Button>
              <Button
                variant={
                  request.variant === 'danger' ? 'destructive' : 'primary'
                }
                onClick={() => settle(true)}
              >
                {request.confirmLabel ?? t('common.confirm')}
              </Button>
            </Inline>
          }
        >
          {request.description}
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

ConfirmProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
