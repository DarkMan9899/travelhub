/**
 * ReviewForm — shown on `BookingDetailPageContent` for a COMPLETED
 * booking the caller hasn't reviewed yet. Rating is a `Select` of 1-5
 * (not a star-click input) — `RatingStars` is explicitly read-only-only
 * per its own header comment; a labeled numeric control keeps this form
 * accessible without inventing a new design-system primitive for a
 * single caller.
 */

import { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Stack } from '@travelhub/ui/components/layout';
import {
  Input,
  Textarea,
  Select,
} from '@travelhub/ui/components/form-controls';
import { Button } from '@travelhub/ui/components/primitives';
import { useToast } from '../../../../contexts/ToastContext.jsx';
import { useSubmitReviewMutation } from '../../mutations/useSubmitReviewMutation.js';

export default function ReviewForm({ bookingId, listingId }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const submitReviewMutation = useSubmitReviewMutation(bookingId, listingId);
  const [rating, setRating] = useState('5');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const ratingOptions = [5, 4, 3, 2, 1].map((value) => ({
    value: String(value),
    label: t(`reviews.form.ratingOptions.${value}`),
  }));

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      await submitReviewMutation.mutateAsync({
        rating: Number(rating),
        title: title.trim() || undefined,
        content: content.trim() || undefined,
      });
      showToast(t('reviews.form.submitSuccess'), { variant: 'success' });
    } catch {
      showToast(t('reviews.form.submitError'), { variant: 'danger' });
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="3">
        <Select
          label={t('reviews.form.ratingLabel')}
          options={ratingOptions}
          value={rating}
          onChange={setRating}
        />
        <Input
          label={t('reviews.form.titleLabel')}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={255}
        />
        <Textarea
          label={t('reviews.form.contentLabel')}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={4}
          maxLength={4000}
        />
        <Button
          type="submit"
          variant="primary"
          loading={submitReviewMutation.isPending}
        >
          {t('reviews.form.submitAction')}
        </Button>
      </Stack>
    </form>
  );
}

ReviewForm.propTypes = {
  bookingId: PropTypes.number.isRequired,
  listingId: PropTypes.number.isRequired,
};
