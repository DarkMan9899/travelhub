/**
 * AvatarUploader — click-the-avatar-to-replace-it pattern (no drag/drop —
 * `FileDropzone` is built for the Listing Wizard's multi-photo gallery
 * flow, a mismatched shape for a single profile picture). Client-side
 * mirrors `POST /users/:id/avatar`'s own MIME/size policy
 * (`apps/api/src/modules/media/validators/mediaConstraints.js`) so a
 * rejected upload never round-trips to the server first — the backend
 * remains the source of truth, this is purely a faster failure path.
 */

import { useRef } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@desavii/ui/components/primitives';
import { Spinner } from '@desavii/ui/components/feedback-overlays';
import styles from './AvatarUploader.module.scss';

const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export default function AvatarUploader({
  name,
  userId,
  src = undefined,
  isUploading,
  onUpload,
  onValidationError,
}) {
  const { t } = useTranslation();
  const inputRef = useRef(null);

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      onValidationError(t('profile.avatar.errorType'));
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      onValidationError(t('profile.avatar.errorSize'));
      return;
    }
    onUpload(file);
  }

  return (
    <div className={styles.uploader}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        aria-label={t('profile.avatar.changeAction')}
      >
        <Avatar name={name} userId={userId} src={src} size="xl" />
        {isUploading && (
          <span className={styles.overlay}>
            <Spinner size="sm" decorative />
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_MIME_TYPES.join(',')}
        className={styles.input}
        onChange={handleFileChange}
        aria-hidden="true"
        tabIndex={-1}
      />
      <p className={styles.hint}>{t('profile.avatar.hint')}</p>
    </div>
  );
}

AvatarUploader.propTypes = {
  name: PropTypes.string.isRequired,
  userId: PropTypes.string.isRequired,
  src: PropTypes.string,
  isUploading: PropTypes.bool.isRequired,
  onUpload: PropTypes.func.isRequired,
  onValidationError: PropTypes.func.isRequired,
};
