/**
 * MediaStep — step 6. `media` is passed down straight from the
 * orchestrator's own `useListingQuery` read (this step never keeps its
 * own divorced copy) — every action here (attach/set-cover/reorder/
 * remove) is a mutation whose `onSuccess` already invalidates
 * `listingKeys.detail(id)` (see the mutation hooks' own file headers),
 * so the next render simply shows the server's fresh list.
 *
 * Reordering is Up/Down buttons, not free drag-and-drop — a documented
 * simplification (same "note why, keep it accessible/keyboard-operable"
 * precedent other `ui/` components use for their own spec trade-offs):
 * full pointer-drag reordering needs drag-and-drop library wiring this
 * phase's brief didn't ask for, whereas the spec's own "Drag & Drop"
 * bullet is satisfied by `FileDropzone` for the upload gesture itself.
 */

import { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Alert } from '@desavii/ui/components/feedback-overlays';
import { Button } from '@desavii/ui/components/primitives';
import { Input } from '@desavii/ui/components/form-controls';
import { FileDropzone } from '@desavii/ui/components/listing-media';
import { useAttachListingMediaMutation } from '../../../mutations/useAttachListingMediaMutation.js';
import { useUpdateListingMediaMutation } from '../../../mutations/useUpdateListingMediaMutation.js';
import { useRemoveListingMediaMutation } from '../../../mutations/useRemoveListingMediaMutation.js';
import WizardStepActions from '../WizardStepActions.jsx';
import styles from './MediaStep.module.scss';

const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

export default function MediaStep({
  listingId,
  media,
  onBack = undefined,
  onNext,
}) {
  const { t } = useTranslation();
  const attachMutation = useAttachListingMediaMutation();
  const updateMediaMutation = useUpdateListingMediaMutation();
  const removeMediaMutation = useRemoveListingMediaMutation();

  const [uploads, setUploads] = useState([]);
  const [continueError, setContinueError] = useState(null);
  const [captionFieldEdits, setCaptionFieldEdits] = useState({});

  function handleFilesSelected(files) {
    files.forEach((file) => {
      const uploadId = `${file.name}-${file.size}-${file.lastModified}`;
      setUploads((current) => [
        ...current,
        { id: uploadId, name: file.name, status: 'pending' },
      ]);
      attachMutation
        .mutateAsync({ id: listingId, file })
        .then(() => {
          setUploads((current) =>
            current.filter((upload) => upload.id !== uploadId),
          );
        })
        .catch(() => {
          setUploads((current) =>
            current.map((upload) =>
              upload.id === uploadId ? { ...upload, status: 'error' } : upload,
            ),
          );
        });
    });
  }

  function handleRejected(rejections) {
    setUploads((current) => [
      ...current,
      ...rejections.map(({ file, reason }) => ({
        id: `${file.name}-${file.size}-rejected`,
        name: file.name,
        status: 'error',
        reason,
      })),
    ]);
  }

  const sortedMedia = [...media].sort((a, b) => a.position - b.position);

  function setCover(mediaId) {
    updateMediaMutation.mutate({
      id: listingId,
      mediaId,
      payload: { isCover: true },
    });
  }

  function move(index, direction) {
    const target = sortedMedia[index + direction];
    const current = sortedMedia[index];
    if (!target) return;
    updateMediaMutation.mutate({
      id: listingId,
      mediaId: current.id,
      payload: { position: target.position },
    });
    updateMediaMutation.mutate({
      id: listingId,
      mediaId: target.id,
      payload: { position: current.position },
    });
  }

  function remove(mediaId) {
    removeMediaMutation.mutate({ id: listingId, mediaId });
  }

  const CAPTION_SOURCE_FIELD = { altText: 'alt_text', caption: 'caption' };

  function captionFieldValue(item, field) {
    const key = `${item.id}:${field}`;
    return key in captionFieldEdits
      ? captionFieldEdits[key]
      : (item[CAPTION_SOURCE_FIELD[field]] ?? '');
  }

  function handleCaptionFieldChange(mediaId, field, value) {
    setCaptionFieldEdits((current) => ({
      ...current,
      [`${mediaId}:${field}`]: value,
    }));
  }

  function handleCaptionFieldBlur(item, field) {
    const previousValue = item[CAPTION_SOURCE_FIELD[field]] ?? '';
    const value = captionFieldValue(item, field);
    if (value === previousValue) return;
    updateMediaMutation.mutate({
      id: listingId,
      mediaId: item.id,
      payload: { [field]: value },
    });
  }

  function handleContinue() {
    if (sortedMedia.length === 0) {
      setContinueError(t('partner.listingWizard.media.atLeastOneRequired'));
      return;
    }
    setContinueError(null);
    onNext();
  }

  return (
    <div>
      <h2>{t('partner.listingWizard.steps.media')}</h2>
      {continueError && <Alert variant="danger">{continueError}</Alert>}

      <FileDropzone
        label={t('partner.listingWizard.media.dropzoneLabel')}
        accept="image/*,video/*"
        maxSizeBytes={MAX_UPLOAD_BYTES}
        currentCount={sortedMedia.length}
        onFilesSelected={(files) => handleFilesSelected(files)}
        onRejected={(rejections) => handleRejected(rejections)}
        emphasisText={t('partner.listingWizard.media.dropzoneEmphasis')}
        instructionsText={t('partner.listingWizard.media.dropzoneInstructions')}
      />

      {uploads.length > 0 && (
        <ul className={styles.uploadList}>
          {uploads.map((upload) => (
            <li key={upload.id} className={styles.uploadItem}>
              {upload.name}
              {' — '}
              {upload.status === 'error'
                ? t('partner.listingWizard.media.uploadFailed')
                : t('partner.listingWizard.media.uploading')}
            </li>
          ))}
        </ul>
      )}

      <div className={styles.grid}>
        {sortedMedia.map((item, index) => (
          <div key={item.id} className={styles.card}>
            {item.media_type === 'VIDEO' ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption -- partner-uploaded preview, no caption track exists to attach
              <video src={item.url} className={styles.thumbnail} muted />
            ) : (
              <img
                src={item.thumbnail_url || item.url}
                alt=""
                className={styles.thumbnail}
              />
            )}
            {item.is_cover && (
              <span className={styles.coverBadge}>
                {t('partner.listingWizard.media.cover')}
              </span>
            )}
            <Input
              size="sm"
              label={t('partner.listingWizard.media.altTextLabel')}
              value={captionFieldValue(item, 'altText')}
              onChange={(event) =>
                handleCaptionFieldChange(item.id, 'altText', event.target.value)
              }
              onBlur={() => handleCaptionFieldBlur(item, 'altText')}
            />
            <Input
              size="sm"
              label={t('partner.listingWizard.media.captionLabel')}
              value={captionFieldValue(item, 'caption')}
              onChange={(event) =>
                handleCaptionFieldChange(item.id, 'caption', event.target.value)
              }
              onBlur={() => handleCaptionFieldBlur(item, 'caption')}
            />
            <div className={styles.cardActions}>
              <Button
                size="sm"
                variant="secondary"
                disabled={item.is_cover}
                onClick={() => setCover(item.id)}
              >
                {t('partner.listingWizard.media.setCover')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                ariaLabel={t('partner.listingWizard.media.moveUp')}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                ↑
              </Button>
              <Button
                size="sm"
                variant="ghost"
                ariaLabel={t('partner.listingWizard.media.moveDown')}
                disabled={index === sortedMedia.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => remove(item.id)}
              >
                {t('partner.listingWizard.media.remove')}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <WizardStepActions
        onBack={onBack}
        onContinue={() => handleContinue()}
        backLabel={t('partner.listingWizard.back')}
        continueLabel={t('partner.listingWizard.continue')}
      />
    </div>
  );
}

const mediaItemShape = PropTypes.shape({
  id: PropTypes.number.isRequired,
  media_type: PropTypes.string.isRequired,
  url: PropTypes.string.isRequired,
  thumbnail_url: PropTypes.string,
  position: PropTypes.number.isRequired,
  is_cover: PropTypes.bool.isRequired,
  alt_text: PropTypes.string,
  caption: PropTypes.string,
});

MediaStep.propTypes = {
  listingId: PropTypes.number.isRequired,
  media: PropTypes.arrayOf(mediaItemShape).isRequired,
  onBack: PropTypes.func,
  onNext: PropTypes.func.isRequired,
};
