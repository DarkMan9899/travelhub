/**
 * PartnerAiToolRow — one generate-and-review row, shared by every tool in
 * `PartnerAiToolsPanel`. Content is always shown read-only for the
 * partner to copy themselves; this component never applies it to the
 * listing.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Button } from '@travelhub/ui/components/primitives';
import { Textarea } from '@travelhub/ui/components/form-controls';
import { Stack, Inline } from '@travelhub/ui/components/layout';

export default function PartnerAiToolRow({
  label,
  extraInput = null,
  mutation,
  onGenerate,
}) {
  const { t } = useTranslation();
  const content = mutation.data?.data?.content ?? '';

  return (
    <Stack gap="2">
      <Inline gap="2" align="flex-end">
        <strong>{label}</strong>
        {extraInput}
        <Button
          type="button"
          size="sm"
          disabled={mutation.isPending}
          onClick={onGenerate}
        >
          {mutation.isPending
            ? t('ai.partnerTools.generating')
            : t('ai.partnerTools.generate')}
        </Button>
      </Inline>
      {mutation.isError && (
        <span role="alert">
          {mutation.error?.message ?? t('ai.partnerTools.error')}
        </span>
      )}
      {content && (
        <Textarea
          label={t('ai.partnerTools.resultLabel')}
          value={content}
          onChange={() => {}}
          disabled
          rows={3}
        />
      )}
    </Stack>
  );
}

PartnerAiToolRow.propTypes = {
  label: PropTypes.string.isRequired,
  extraInput: PropTypes.node,
  // eslint-disable-next-line react/forbid-prop-types -- a React Query UseMutationResult, not a plain data object this component owns the shape of
  mutation: PropTypes.object.isRequired,
  onGenerate: PropTypes.func.isRequired,
};
