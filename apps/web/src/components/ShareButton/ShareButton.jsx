/**
 * ShareButton — Phase 18 (Premium Listing Detail): shares the current
 * page URL. Uses the real Web Share API (`navigator.share`) when the
 * browser supports it (mobile Safari/Chrome — the native OS share
 * sheet); falls back to copying the URL to the clipboard and confirming
 * via the existing toast queue everywhere else (most desktop browsers).
 * Never a dead button — one of the two paths always does something real.
 */

import { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Share2 } from 'lucide-react';
import { Button } from '@desavii/ui/components/primitives';
import { useToast } from '../../contexts/ToastContext.jsx';

export default function ShareButton({
  title = undefined,
  className = undefined,
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [isSharing, setIsSharing] = useState(false);

  async function handleShare(event) {
    event.preventDefault();
    event.stopPropagation();
    const url = window.location.href;

    if (navigator.share) {
      setIsSharing(true);
      try {
        await navigator.share({ title, url });
      } catch {
        // AbortError (user cancelled the native share sheet) and any
        // other failure are both silent no-ops — cancelling isn't an
        // error worth a toast, and there's no meaningful recovery for
        // a genuine share-API failure beyond the clipboard fallback the
        // user can trigger by copying the URL themselves.
      } finally {
        setIsSharing(false);
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      showToast(t('pages.listingDetail.share.copied'), { variant: 'success' });
    } catch {
      showToast(t('pages.listingDetail.share.copyError'), {
        variant: 'danger',
      });
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={className}
      ariaLabel={t('pages.listingDetail.share.button')}
      onClick={(event) => handleShare(event)}
      disabled={isSharing}
      iconLeft={<Share2 size={18} aria-hidden="true" />}
    />
  );
}

ShareButton.propTypes = {
  title: PropTypes.string,
  className: PropTypes.string,
};
