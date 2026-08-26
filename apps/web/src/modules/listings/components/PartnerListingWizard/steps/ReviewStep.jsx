/**
 * ReviewStep — step 10, and the wizard's one authoritative
 * publish-readiness gate. `POST /listings/:id/publish` rejects with a
 * 422 carrying `error.details` (`{ field, issue }[]` —
 * `ListingService.#checkPublishReadiness`) until every requirement
 * passes; this step renders that itemized list directly rather than
 * re-deriving readiness client-side, since the server is the only place
 * that actually knows every rule (required attributes/policies per
 * category, media, location, translation, >=1 bookable unit).
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Alert } from '@desavii/ui/components/feedback-overlays';
import { Stack } from '@desavii/ui/components/layout';
import { usePublishListingMutation } from '../../../mutations/usePublishListingMutation.js';
import { PartnerAiToolsPanel, AskAiButton } from '../../../../ai/index.js';
import ListingCompletenessWidget from '../ListingCompletenessWidget.jsx';
import WizardStepActions from '../WizardStepActions.jsx';

export default function ReviewStep({
  listing,
  onBack = undefined,
  onPublished,
}) {
  const { t } = useTranslation();
  const publishMutation = usePublishListingMutation();

  const title = listing.translations[0]?.title;
  const issues = publishMutation.error?.details ?? [];

  async function handlePublish() {
    try {
      await publishMutation.mutateAsync(listing.id);
      onPublished();
    } catch {
      // Surfaced below via publishMutation.error's `details` — no further
      // action needed here.
    }
  }

  return (
    <div>
      <h2>{t('partner.listingWizard.steps.review')}</h2>

      {publishMutation.error && (
        <Alert variant="danger">
          {publishMutation.error.message}
          {issues.length > 0 && (
            <ul>
              {issues.map((issue) => (
                <li key={`${issue.field}-${issue.issue}`}>
                  {t(`partner.listingWizard.publishIssues.${issue.issue}`, {
                    field: issue.field,
                    defaultValue: `${issue.field}: ${issue.issue}`,
                  })}
                </li>
              ))}
            </ul>
          )}
        </Alert>
      )}

      <Stack gap="2" as="dl">
        <div>
          <dt>{t('partner.listingWizard.review.title')}</dt>
          <dd>{title}</dd>
        </div>
        <div>
          <dt>{t('partner.listingWizard.review.location')}</dt>
          <dd>
            {listing.location
              ? `${listing.location.latitude}, ${listing.location.longitude}`
              : t('partner.listingWizard.review.notSet')}
          </dd>
        </div>
        <div>
          <dt>{t('partner.listingWizard.review.media')}</dt>
          <dd>
            {t('partner.listingWizard.review.mediaCount', {
              count: listing.media.length,
            })}
          </dd>
        </div>
        <div>
          <dt>{t('partner.listingWizard.review.amenities')}</dt>
          <dd>
            {t('partner.listingWizard.review.amenitiesCount', {
              count: listing.amenity_ids?.length ?? 0,
            })}
          </dd>
        </div>
        <div>
          <dt>{t('partner.listingWizard.review.pricing')}</dt>
          <dd>
            {listing.pricing
              ? `${listing.pricing.amount} ${listing.pricing.currency} (${t(
                  `partner.listingWizard.pricingModels.${listing.pricing.pricing_model}`,
                  listing.pricing.pricing_model,
                )})`
              : t('partner.listingWizard.review.notSet')}
          </dd>
        </div>
      </Stack>

      <ListingCompletenessWidget listingId={listing.id} />

      <PartnerAiToolsPanel listingId={listing.id} />

      <AskAiButton
        label={t('ai.contextButtons.improveListing')}
        contextType="listing"
        contextId={listing.id}
        initialMessage={t('ai.contextButtons.improveListingInitialMessage')}
        variant="secondary"
      />

      <WizardStepActions
        onBack={onBack}
        onContinue={() => handlePublish()}
        isSubmitting={publishMutation.isPending}
        backLabel={t('partner.listingWizard.back')}
        continueLabel={t('partner.listingWizard.publish')}
      />
    </div>
  );
}

ReviewStep.propTypes = {
  listing: PropTypes.shape({
    id: PropTypes.number.isRequired,
    translations: PropTypes.arrayOf(
      PropTypes.shape({ title: PropTypes.string }),
    ).isRequired,
    location: PropTypes.shape({
      latitude: PropTypes.number,
      longitude: PropTypes.number,
    }),
    // eslint-disable-next-line react/forbid-prop-types -- only .length is read here; the full media item shape is MediaStep's concern
    media: PropTypes.array.isRequired,
    amenity_ids: PropTypes.arrayOf(PropTypes.number),
    pricing: PropTypes.shape({
      amount: PropTypes.number,
      currency: PropTypes.string,
      pricing_model: PropTypes.string,
    }),
  }).isRequired,
  onBack: PropTypes.func,
  onPublished: PropTypes.func.isRequired,
};
