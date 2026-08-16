import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ContentStep from './ContentStep.jsx';
import { useReplaceListingHighlightsMutation } from '../../../mutations/useReplaceListingHighlightsMutation.js';
import { useReplaceListingItineraryMutation } from '../../../mutations/useReplaceListingItineraryMutation.js';
import { useReplaceListingIncludedItemsMutation } from '../../../mutations/useReplaceListingIncludedItemsMutation.js';
import { useReplaceListingFaqsMutation } from '../../../mutations/useReplaceListingFaqsMutation.js';

vi.mock('../../../mutations/useReplaceListingHighlightsMutation.js', () => ({
  useReplaceListingHighlightsMutation: vi.fn(),
}));
vi.mock('../../../mutations/useReplaceListingItineraryMutation.js', () => ({
  useReplaceListingItineraryMutation: vi.fn(),
}));
vi.mock('../../../mutations/useReplaceListingIncludedItemsMutation.js', () => ({
  useReplaceListingIncludedItemsMutation: vi.fn(),
}));
vi.mock('../../../mutations/useReplaceListingFaqsMutation.js', () => ({
  useReplaceListingFaqsMutation: vi.fn(),
}));

// This project's test setup defaults i18next to Armenian (hy) — mirrors
// the exact locale-string convention every other wizard-step test file
// (e.g. MediaStep.test.jsx) already uses, rather than English.
const ADD_HIGHLIGHT = 'Ավելացնել առանձնահատկություն';
const REMOVE_ROW = 'Հեռացնել';
const ADD_FAQ = 'Ավելացնել հարց';
const QUESTION_LABEL = 'Հարց';
const CONTINUE = 'Շարունակել';
const REQUIRED_ERROR = 'Այս դաշտը պարտադիր է:';

const INITIAL_VALUES = {
  highlights: [{ icon_code: 'wifi', text: 'Free Wi-Fi throughout' }],
  itinerarySteps: [
    { title: 'Pickup', description: 'Hotel pickup', duration_minutes: 30 },
  ],
  includedItems: [{ item_text: 'Breakfast', is_included: true }],
  faqs: [{ question: 'Is parking free?', answer: 'Yes, on-site.' }],
};

describe('ContentStep (PartnerListingWizard)', () => {
  let highlightsMutateAsync;
  let itineraryMutateAsync;
  let includedItemsMutateAsync;
  let faqsMutateAsync;

  beforeEach(() => {
    highlightsMutateAsync = vi.fn().mockResolvedValue({ data: {} });
    itineraryMutateAsync = vi.fn().mockResolvedValue({ data: {} });
    includedItemsMutateAsync = vi.fn().mockResolvedValue({ data: {} });
    faqsMutateAsync = vi.fn().mockResolvedValue({ data: {} });

    useReplaceListingHighlightsMutation.mockReturnValue({
      mutateAsync: highlightsMutateAsync,
      isPending: false,
      error: null,
    });
    useReplaceListingItineraryMutation.mockReturnValue({
      mutateAsync: itineraryMutateAsync,
      isPending: false,
      error: null,
    });
    useReplaceListingIncludedItemsMutation.mockReturnValue({
      mutateAsync: includedItemsMutateAsync,
      isPending: false,
      error: null,
    });
    useReplaceListingFaqsMutation.mockReturnValue({
      mutateAsync: faqsMutateAsync,
      isPending: false,
      error: null,
    });
  });

  test('renders existing highlights/itinerary/included items/faqs from initialValues', () => {
    render(
      <ContentStep
        listingId={7}
        initialValues={INITIAL_VALUES}
        onNext={vi.fn()}
      />,
    );
    expect(
      screen.getByDisplayValue('Free Wi-Fi throughout'),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('Pickup')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Breakfast')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Is parking free?')).toBeInTheDocument();
  });

  test('adding a highlight row then removing it changes the row count without erroring', async () => {
    const user = userEvent.setup();
    render(
      <ContentStep
        listingId={7}
        initialValues={INITIAL_VALUES}
        onNext={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: ADD_HIGHLIGHT }));
    const removeButtons = screen.getAllByRole('button', { name: REMOVE_ROW });
    expect(removeButtons.length).toBeGreaterThan(3);
    await user.click(removeButtons[removeButtons.length - 1]);
    expect(
      screen.getAllByRole('button', { name: REMOVE_ROW }).length,
    ).toBeLessThan(removeButtons.length);
  });

  test('Continue sends the full replace payload for all four collections and calls onNext', async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(
      <ContentStep
        listingId={7}
        initialValues={INITIAL_VALUES}
        onNext={onNext}
      />,
    );

    await user.click(screen.getByRole('button', { name: CONTINUE }));

    expect(highlightsMutateAsync).toHaveBeenCalledWith({
      id: 7,
      highlights: [{ iconCode: 'wifi', text: 'Free Wi-Fi throughout' }],
    });
    expect(itineraryMutateAsync).toHaveBeenCalledWith({
      id: 7,
      steps: [
        { title: 'Pickup', description: 'Hotel pickup', durationMinutes: 30 },
      ],
    });
    expect(includedItemsMutateAsync).toHaveBeenCalledWith({
      id: 7,
      items: [{ itemText: 'Breakfast', isIncluded: true }],
    });
    expect(faqsMutateAsync).toHaveBeenCalledWith({
      id: 7,
      faqs: [{ question: 'Is parking free?', answer: 'Yes, on-site.' }],
    });
    expect(onNext).toHaveBeenCalled();
  });

  test('a blank added row is silently dropped from the payload on Continue', async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(
      <ContentStep
        listingId={7}
        initialValues={INITIAL_VALUES}
        onNext={onNext}
      />,
    );

    await user.click(screen.getByRole('button', { name: ADD_HIGHLIGHT }));
    await user.click(screen.getByRole('button', { name: CONTINUE }));

    expect(highlightsMutateAsync).toHaveBeenCalledWith({
      id: 7,
      highlights: [{ iconCode: 'wifi', text: 'Free Wi-Fi throughout' }],
    });
    expect(onNext).toHaveBeenCalled();
  });

  test('a FAQ row with only a question filled in blocks Continue with an inline error', async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(
      <ContentStep
        listingId={7}
        initialValues={INITIAL_VALUES}
        onNext={onNext}
      />,
    );

    await user.click(screen.getByRole('button', { name: ADD_FAQ }));
    const questionInputs = screen.getAllByLabelText(QUESTION_LABEL);
    await user.type(
      questionInputs[questionInputs.length - 1],
      'Any pets allowed?',
    );
    await user.click(screen.getByRole('button', { name: CONTINUE }));

    expect(screen.getByText(REQUIRED_ERROR)).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
    expect(faqsMutateAsync).not.toHaveBeenCalled();
  });

  test('starts with empty collections when no initialValues are provided', () => {
    render(<ContentStep listingId={9} onNext={vi.fn()} />);
    expect(
      screen.queryByDisplayValue('Free Wi-Fi throughout'),
    ).not.toBeInTheDocument();
  });
});
