/**
 * PartnerAiToolsPanel (Stage 15.5) — six AI content-generation tools for
 * the partner's own listing (grounded server-side in that listing's real
 * fields, `partnerAiService.js`), wired into the wizard's `ReviewStep` —
 * the point where every field the tools ground on (title, category,
 * city, policies) is already real, and re-entering the wizard for an
 * existing listing is this app's only edit flow (no separate edit page
 * exists). Every result is shown for the partner to review and copy
 * into the relevant earlier step themselves — nothing here writes to
 * the listing directly.
 */

import { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Input, Select } from '@desavii/ui/components/form-controls';
import { Card } from '@desavii/ui/components/primitives';
import { Stack } from '@desavii/ui/components/layout';
import {
  useGenerateListingDescriptionMutation,
  useGenerateListingSeoMutation,
  useGenerateListingTitleMutation,
  useGenerateListingAmenitiesMutation,
  useTranslateListingMutation,
  useGenerateListingFaqsMutation,
} from '../../mutations/usePartnerAiToolMutations.js';
import PartnerAiToolRow from './PartnerAiToolRow.jsx';

const TARGET_LANGUAGES = [
  { value: 'hy', label: 'Հայերեն' },
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
];

export default function PartnerAiToolsPanel({ listingId }) {
  const { t } = useTranslation();
  const [keyFeature, setKeyFeature] = useState('');
  const [targetLanguageCode, setTargetLanguageCode] = useState('ru');

  const descriptionMutation = useGenerateListingDescriptionMutation();
  const seoMutation = useGenerateListingSeoMutation();
  const titleMutation = useGenerateListingTitleMutation();
  const amenitiesMutation = useGenerateListingAmenitiesMutation();
  const translateMutation = useTranslateListingMutation();
  const faqsMutation = useGenerateListingFaqsMutation();

  return (
    <Card as="div" padding="lg">
      <Stack gap="4">
        <h2>{t('ai.partnerTools.heading')}</h2>
        <p>{t('ai.partnerTools.description')}</p>

        <PartnerAiToolRow
          label={t('ai.partnerTools.tools.description')}
          mutation={descriptionMutation}
          onGenerate={() => descriptionMutation.mutate(listingId)}
        />
        <PartnerAiToolRow
          label={t('ai.partnerTools.tools.seo')}
          mutation={seoMutation}
          onGenerate={() => seoMutation.mutate(listingId)}
        />
        <PartnerAiToolRow
          label={t('ai.partnerTools.tools.title')}
          extraInput={
            <Input
              aria-label={t('ai.partnerTools.keyFeatureLabel')}
              placeholder={t('ai.partnerTools.keyFeaturePlaceholder')}
              value={keyFeature}
              onChange={(event) => setKeyFeature(event.target.value)}
            />
          }
          mutation={titleMutation}
          onGenerate={() =>
            titleMutation.mutate({
              listingId,
              keyFeature: keyFeature.trim() || undefined,
            })
          }
        />
        <PartnerAiToolRow
          label={t('ai.partnerTools.tools.amenities')}
          mutation={amenitiesMutation}
          onGenerate={() => amenitiesMutation.mutate(listingId)}
        />
        <PartnerAiToolRow
          label={t('ai.partnerTools.tools.translate')}
          extraInput={
            <Select
              ariaLabel={t('ai.partnerTools.targetLanguageLabel')}
              value={targetLanguageCode}
              onChange={(value) => setTargetLanguageCode(value)}
              options={TARGET_LANGUAGES}
            />
          }
          mutation={translateMutation}
          onGenerate={() =>
            translateMutation.mutate({ listingId, targetLanguageCode })
          }
        />
        <PartnerAiToolRow
          label={t('ai.partnerTools.tools.faqs')}
          mutation={faqsMutation}
          onGenerate={() => faqsMutation.mutate(listingId)}
        />
      </Stack>
    </Card>
  );
}

PartnerAiToolsPanel.propTypes = {
  listingId: PropTypes.number.isRequired,
};
