/**
 * RoomMediaGallery (Sprint C-1) — room-specific photo gallery for one
 * `bookable_unit`. Mirrors `MediaStep`'s upload/cover/remove pattern
 * (same `FileDropzone`, same immediate-mutation-per-file model) scoped to
 * `mediable_type = 'bookable_unit'` instead of `'listing'` — a
 * deliberately independent gallery, never copied from or shared with the
 * listing's own photos. No reorder controls (unlike `MediaStep`) — a
 * deliberate MVP simplification for this sprint; `position` is still set
 * server-side at upload time (upload order), so the gallery is never
 * unordered.
 */

import { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Alert } from '@desavii/ui/components/feedback-overlays';
import { Button } from '@desavii/ui/components/primitives';
import { FileDropzone } from '@desavii/ui/components/listing-media';
import { Stack } from '@desavii/ui/components/layout';
import {
  useAttachBookableUnitMediaMutation,
  useRemoveBookableUnitMediaMutation,
} from '../../../availability/index.js';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export default function RoomMediaGallery({ unitId, listingId, media = [] }) {
  const { t } = useTranslation();
  const attachMutation = useAttachBookableUnitMediaMutation();
  const removeMutation = useRemoveBookableUnitMediaMutation();

  const [uploads, setUploads] = useState([]);

  // Sequential, never `Promise.all`/parallel `forEach`: the server derives
  // each new photo's `position`/`is_cover` from how many photos already
  // exist for this room at request time — two uploads racing in parallel
  // would both see "0 existing photos" and both become the cover. Only
  // ever one attach request in flight for this room at a time.
  async function handleFilesSelected(files) {
    // eslint-disable-next-line no-restricted-syntax -- must upload one at a time, in order
    for (const file of files) {
      const uploadId = `${file.name}-${file.size}-${file.lastModified}`;
      setUploads((current) => [
        ...current,
        { id: uploadId, name: file.name, status: 'pending' },
      ]);
      try {
        // eslint-disable-next-line no-await-in-loop -- sequential by design, see comment above
        await attachMutation.mutateAsync({ id: unitId, listingId, file });
        setUploads((current) =>
          current.filter((upload) => upload.id !== uploadId),
        );
      } catch {
        setUploads((current) =>
          current.map((upload) =>
            upload.id === uploadId ? { ...upload, status: 'error' } : upload,
          ),
        );
      }
    }
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

  function remove(mediaId) {
    removeMutation.mutate({ id: unitId, listingId, mediaId });
  }

  const sortedMedia = [...media].sort((a, b) => a.position - b.position);

  return (
    <Stack gap="3">
      <h4>{t('partner.listingWizard.availability.roomGalleryHeading')}</h4>
      {(attachMutation.isError || removeMutation.isError) && (
        <Alert variant="danger">
          {(attachMutation.error ?? removeMutation.error).message}
        </Alert>
      )}

      <FileDropzone
        label={t('partner.listingWizard.availability.roomGalleryDropzone')}
        accept="image/*"
        maxSizeBytes={MAX_UPLOAD_BYTES}
        currentCount={sortedMedia.length}
        onFilesSelected={(files) => handleFilesSelected(files)}
        onRejected={(rejections) => handleRejected(rejections)}
        emphasisText={t('partner.listingWizard.media.dropzoneEmphasis')}
        instructionsText={t('partner.listingWizard.media.dropzoneInstructions')}
      />

      {uploads.length > 0 && (
        <ul>
          {uploads.map((upload) => (
            <li key={upload.id}>
              {upload.name}
              {' — '}
              {upload.status === 'error'
                ? t('partner.listingWizard.media.uploadFailed')
                : t('partner.listingWizard.media.uploading')}
            </li>
          ))}
        </ul>
      )}

      <Stack gap="2">
        {sortedMedia.map((item) => (
          <div key={item.id}>
            <img
              src={item.thumbnail_url || item.url}
              alt=""
              width="120"
              height="80"
            />
            {item.is_cover && (
              <span>{t('partner.listingWizard.media.cover')}</span>
            )}
            <Button
              size="sm"
              variant="destructive"
              onClick={() => remove(item.id)}
            >
              {t('partner.listingWizard.media.remove')}
            </Button>
          </div>
        ))}
      </Stack>
    </Stack>
  );
}

RoomMediaGallery.propTypes = {
  unitId: PropTypes.number.isRequired,
  listingId: PropTypes.number.isRequired,
  media: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number.isRequired,
      url: PropTypes.string.isRequired,
      thumbnail_url: PropTypes.string,
      position: PropTypes.number.isRequired,
      is_cover: PropTypes.bool.isRequired,
    }),
  ),
};
