/**
 * ContentStep — step 10 (Phase 18.10). Editors for the four Phase 18
 * rich-content collections a listing can carry: Highlights, Itinerary,
 * Included/Not-included items, and FAQs. Each section is a local add/
 * edit/remove row list; `handleContinue` sends the *entire* desired
 * array to its own full-replace `PATCH /listings/:id/{highlights,
 * itinerary,included-items,faqs}` endpoint (mirrors `MediaStep`'s
 * per-field-write shape, just four collections instead of one).
 *
 * A row left completely blank (every field empty) is silently dropped
 * on Continue rather than blocking submission — it's how a partner
 * "cancels" an accidental Add click. A row that's partially filled
 * (e.g. an itinerary step with a title but the FAQ's matching answer
 * missing) surfaces an inline required-field error instead, since a
 * half-written FAQ published as-is would be broken content, not an
 * empty one.
 *
 * Every field here is optional at the listing level — the completeness
 * widget (`useListingCompletenessQuery`, rendered on the Review step)
 * is what tells a partner highlights/FAQs are only *recommended*, not
 * required to publish.
 */

import { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Alert } from '@desavii/ui/components/feedback-overlays';
import { Button } from '@desavii/ui/components/primitives';
import {
  Input,
  Textarea,
  Select,
  Switch,
} from '@desavii/ui/components/form-controls';
import { Stack } from '@desavii/ui/components/layout';
import { useReplaceListingHighlightsMutation } from '../../../mutations/useReplaceListingHighlightsMutation.js';
import { useReplaceListingItineraryMutation } from '../../../mutations/useReplaceListingItineraryMutation.js';
import { useReplaceListingIncludedItemsMutation } from '../../../mutations/useReplaceListingIncludedItemsMutation.js';
import { useReplaceListingFaqsMutation } from '../../../mutations/useReplaceListingFaqsMutation.js';
import { HIGHLIGHT_ICON_CODES } from '../../../utils/highlightIcons.js';
import WizardStepActions from '../WizardStepActions.jsx';
import styles from './ContentStep.module.scss';

const HIGHLIGHT_MAX = 12;
const ITINERARY_MAX = 30;
const INCLUDED_MAX = 40;
const FAQ_MAX = 20;

export default function ContentStep({
  listingId,
  initialValues = {
    highlights: [],
    itinerarySteps: [],
    includedItems: [],
    faqs: [],
  },
  onBack = undefined,
  onNext,
}) {
  const { t } = useTranslation();
  const replaceHighlights = useReplaceListingHighlightsMutation();
  const replaceItinerary = useReplaceListingItineraryMutation();
  const replaceIncludedItems = useReplaceListingIncludedItemsMutation();
  const replaceFaqs = useReplaceListingFaqsMutation();

  const nextKeyRef = useRef(0);
  function nextKey() {
    nextKeyRef.current += 1;
    return nextKeyRef.current;
  }

  const [highlights, setHighlights] = useState(() =>
    initialValues.highlights.map((row) => ({
      rowKey: nextKey(),
      iconCode: row.icon_code,
      text: row.text,
    })),
  );
  const [itinerarySteps, setItinerarySteps] = useState(() =>
    initialValues.itinerarySteps.map((row) => ({
      rowKey: nextKey(),
      title: row.title,
      description: row.description ?? '',
      durationMinutes:
        row.duration_minutes === null || row.duration_minutes === undefined
          ? ''
          : String(row.duration_minutes),
    })),
  );
  const [includedItems, setIncludedItems] = useState(() =>
    initialValues.includedItems.map((row) => ({
      rowKey: nextKey(),
      itemText: row.item_text,
      isIncluded: row.is_included,
    })),
  );
  const [faqs, setFaqs] = useState(() =>
    initialValues.faqs.map((row) => ({
      rowKey: nextKey(),
      question: row.question,
      answer: row.answer,
    })),
  );
  const [faqErrors, setFaqErrors] = useState({});

  const iconOptions = HIGHLIGHT_ICON_CODES.map((code) => ({
    value: code,
    label: t(`partner.listingWizard.content.highlightIcons.${code}`, {
      defaultValue: code,
    }),
  }));

  function addRow(setter, blankRow, max, currentLength) {
    if (currentLength >= max) return;
    setter((current) => [...current, { rowKey: nextKey(), ...blankRow }]);
  }

  function updateRow(setter, key, field, value) {
    setter((current) =>
      current.map((row) =>
        row.rowKey === key ? { ...row, [field]: value } : row,
      ),
    );
  }

  function removeRow(setter, key) {
    setter((current) => current.filter((row) => row.rowKey !== key));
  }

  async function handleContinue() {
    const validHighlights = highlights
      .filter((row) => row.text.trim().length > 0)
      .map((row) => ({ iconCode: row.iconCode, text: row.text.trim() }));

    const validSteps = itinerarySteps
      .filter((row) => row.title.trim().length > 0)
      .map((row) => ({
        title: row.title.trim(),
        description: row.description.trim() || undefined,
        durationMinutes: row.durationMinutes
          ? Number(row.durationMinutes)
          : undefined,
      }));

    const validIncludedItems = includedItems
      .filter((row) => row.itemText.trim().length > 0)
      .map((row) => ({
        itemText: row.itemText.trim(),
        isIncluded: row.isIncluded,
      }));

    const nextFaqErrors = {};
    const validFaqs = [];
    faqs.forEach((row) => {
      const hasQuestion = row.question.trim().length > 0;
      const hasAnswer = row.answer.trim().length > 0;
      if (!hasQuestion && !hasAnswer) return;
      if (!hasQuestion || !hasAnswer) {
        nextFaqErrors[row.rowKey] = t(
          'partner.listingWizard.validation.required',
        );
        return;
      }
      validFaqs.push({
        question: row.question.trim(),
        answer: row.answer.trim(),
      });
    });
    setFaqErrors(nextFaqErrors);
    if (Object.keys(nextFaqErrors).length > 0) return;

    await Promise.all([
      replaceHighlights.mutateAsync({
        id: listingId,
        highlights: validHighlights,
      }),
      replaceItinerary.mutateAsync({ id: listingId, steps: validSteps }),
      replaceIncludedItems.mutateAsync({
        id: listingId,
        items: validIncludedItems,
      }),
      replaceFaqs.mutateAsync({ id: listingId, faqs: validFaqs }),
    ]);
    onNext();
  }

  const isSubmitting =
    replaceHighlights.isPending ||
    replaceItinerary.isPending ||
    replaceIncludedItems.isPending ||
    replaceFaqs.isPending;
  const mutationError =
    replaceHighlights.error ||
    replaceItinerary.error ||
    replaceIncludedItems.error ||
    replaceFaqs.error;

  return (
    <div>
      <h2>{t('partner.listingWizard.steps.content')}</h2>
      <p className={styles.intro}>{t('partner.listingWizard.content.intro')}</p>
      {mutationError && <Alert variant="danger">{mutationError.message}</Alert>}

      <Stack gap="8">
        <section>
          <h3>{t('partner.listingWizard.content.highlightsTitle')}</h3>
          <p className={styles.sectionHint}>
            {t('partner.listingWizard.content.highlightsHint')}
          </p>
          <Stack gap="3">
            {highlights.map((row) => (
              <div key={row.rowKey} className={styles.row}>
                <Select
                  size="sm"
                  ariaLabel={t('partner.listingWizard.content.iconLabel')}
                  options={iconOptions}
                  value={row.iconCode}
                  onChange={(value) =>
                    updateRow(setHighlights, row.rowKey, 'iconCode', value)
                  }
                />
                <Input
                  size="sm"
                  label={t('partner.listingWizard.content.highlightTextLabel')}
                  value={row.text}
                  onChange={(event) =>
                    updateRow(
                      setHighlights,
                      row.rowKey,
                      'text',
                      event.target.value,
                    )
                  }
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeRow(setHighlights, row.rowKey)}
                >
                  {t('partner.listingWizard.content.removeRow')}
                </Button>
              </div>
            ))}
          </Stack>
          <Button
            size="sm"
            variant="secondary"
            disabled={highlights.length >= HIGHLIGHT_MAX}
            onClick={() =>
              addRow(
                setHighlights,
                { iconCode: HIGHLIGHT_ICON_CODES[0], text: '' },
                HIGHLIGHT_MAX,
                highlights.length,
              )
            }
          >
            {t('partner.listingWizard.content.addHighlight')}
          </Button>
        </section>

        <section>
          <h3>{t('partner.listingWizard.content.itineraryTitle')}</h3>
          <p className={styles.sectionHint}>
            {t('partner.listingWizard.content.itineraryHint')}
          </p>
          <Stack gap="4">
            {itinerarySteps.map((row, index) => (
              <div key={row.rowKey} className={styles.stepCard}>
                <div className={styles.stepCardHeader}>
                  <span className={styles.stepNumber}>{index + 1}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeRow(setItinerarySteps, row.rowKey)}
                  >
                    {t('partner.listingWizard.content.removeRow')}
                  </Button>
                </div>
                <Input
                  size="sm"
                  label={t('partner.listingWizard.content.stepTitleLabel')}
                  value={row.title}
                  onChange={(event) =>
                    updateRow(
                      setItinerarySteps,
                      row.rowKey,
                      'title',
                      event.target.value,
                    )
                  }
                />
                <Textarea
                  size="sm"
                  label={t(
                    'partner.listingWizard.content.stepDescriptionLabel',
                  )}
                  value={row.description}
                  onChange={(event) =>
                    updateRow(
                      setItinerarySteps,
                      row.rowKey,
                      'description',
                      event.target.value,
                    )
                  }
                />
                <Input
                  type="number"
                  size="sm"
                  label={t('partner.listingWizard.content.stepDurationLabel')}
                  value={row.durationMinutes}
                  onChange={(event) =>
                    updateRow(
                      setItinerarySteps,
                      row.rowKey,
                      'durationMinutes',
                      event.target.value,
                    )
                  }
                />
              </div>
            ))}
          </Stack>
          <Button
            size="sm"
            variant="secondary"
            disabled={itinerarySteps.length >= ITINERARY_MAX}
            onClick={() =>
              addRow(
                setItinerarySteps,
                { title: '', description: '', durationMinutes: '' },
                ITINERARY_MAX,
                itinerarySteps.length,
              )
            }
          >
            {t('partner.listingWizard.content.addStep')}
          </Button>
        </section>

        <section>
          <h3>{t('partner.listingWizard.content.includedTitle')}</h3>
          <p className={styles.sectionHint}>
            {t('partner.listingWizard.content.includedHint')}
          </p>
          <Stack gap="3">
            {includedItems.map((row) => (
              <div key={row.rowKey} className={styles.row}>
                <Switch
                  checked={row.isIncluded}
                  onChange={(event) =>
                    updateRow(
                      setIncludedItems,
                      row.rowKey,
                      'isIncluded',
                      event.target.checked,
                    )
                  }
                  label={t(
                    row.isIncluded
                      ? 'partner.listingWizard.content.included'
                      : 'partner.listingWizard.content.notIncluded',
                  )}
                />
                <Input
                  size="sm"
                  label={t('partner.listingWizard.content.itemTextLabel')}
                  value={row.itemText}
                  onChange={(event) =>
                    updateRow(
                      setIncludedItems,
                      row.rowKey,
                      'itemText',
                      event.target.value,
                    )
                  }
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeRow(setIncludedItems, row.rowKey)}
                >
                  {t('partner.listingWizard.content.removeRow')}
                </Button>
              </div>
            ))}
          </Stack>
          <Button
            size="sm"
            variant="secondary"
            disabled={includedItems.length >= INCLUDED_MAX}
            onClick={() =>
              addRow(
                setIncludedItems,
                { itemText: '', isIncluded: true },
                INCLUDED_MAX,
                includedItems.length,
              )
            }
          >
            {t('partner.listingWizard.content.addItem')}
          </Button>
        </section>

        <section>
          <h3>{t('partner.listingWizard.content.faqsTitle')}</h3>
          <p className={styles.sectionHint}>
            {t('partner.listingWizard.content.faqsHint')}
          </p>
          <Stack gap="4">
            {faqs.map((row) => (
              <div key={row.rowKey} className={styles.stepCard}>
                <div className={styles.stepCardHeader}>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeRow(setFaqs, row.rowKey)}
                  >
                    {t('partner.listingWizard.content.removeRow')}
                  </Button>
                </div>
                <Input
                  size="sm"
                  label={t('partner.listingWizard.content.questionLabel')}
                  value={row.question}
                  error={faqErrors[row.rowKey]}
                  onChange={(event) =>
                    updateRow(
                      setFaqs,
                      row.rowKey,
                      'question',
                      event.target.value,
                    )
                  }
                />
                <Textarea
                  size="sm"
                  label={t('partner.listingWizard.content.answerLabel')}
                  value={row.answer}
                  onChange={(event) =>
                    updateRow(setFaqs, row.rowKey, 'answer', event.target.value)
                  }
                />
              </div>
            ))}
          </Stack>
          <Button
            size="sm"
            variant="secondary"
            disabled={faqs.length >= FAQ_MAX}
            onClick={() =>
              addRow(
                setFaqs,
                { question: '', answer: '' },
                FAQ_MAX,
                faqs.length,
              )
            }
          >
            {t('partner.listingWizard.content.addFaq')}
          </Button>
        </section>
      </Stack>

      <WizardStepActions
        onBack={onBack}
        onContinue={() => handleContinue()}
        isSubmitting={isSubmitting}
        backLabel={t('partner.listingWizard.back')}
        continueLabel={t('partner.listingWizard.continue')}
      />
    </div>
  );
}

const highlightShape = PropTypes.shape({
  icon_code: PropTypes.string.isRequired,
  text: PropTypes.string.isRequired,
});

const itineraryStepShape = PropTypes.shape({
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  duration_minutes: PropTypes.number,
});

const includedItemShape = PropTypes.shape({
  item_text: PropTypes.string.isRequired,
  is_included: PropTypes.bool.isRequired,
});

const faqShape = PropTypes.shape({
  question: PropTypes.string.isRequired,
  answer: PropTypes.string.isRequired,
});

ContentStep.propTypes = {
  listingId: PropTypes.number.isRequired,
  initialValues: PropTypes.shape({
    highlights: PropTypes.arrayOf(highlightShape),
    itinerarySteps: PropTypes.arrayOf(itineraryStepShape),
    includedItems: PropTypes.arrayOf(includedItemShape),
    faqs: PropTypes.arrayOf(faqShape),
  }),
  onBack: PropTypes.func,
  onNext: PropTypes.func.isRequired,
};
