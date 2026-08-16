import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PartnerAiToolsPanel from './PartnerAiToolsPanel.jsx';
import {
  useGenerateListingDescriptionMutation,
  useGenerateListingSeoMutation,
  useGenerateListingTitleMutation,
  useGenerateListingAmenitiesMutation,
  useTranslateListingMutation,
  useGenerateListingFaqsMutation,
} from '../../mutations/usePartnerAiToolMutations.js';

vi.mock('../../mutations/usePartnerAiToolMutations.js', () => ({
  useGenerateListingDescriptionMutation: vi.fn(),
  useGenerateListingSeoMutation: vi.fn(),
  useGenerateListingTitleMutation: vi.fn(),
  useGenerateListingAmenitiesMutation: vi.fn(),
  useTranslateListingMutation: vi.fn(),
  useGenerateListingFaqsMutation: vi.fn(),
}));

function idleMutation(overrides = {}) {
  return {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    data: undefined,
    ...overrides,
  };
}

describe('PartnerAiToolsPanel (apps/web/src/modules/ai)', () => {
  let descriptionMutation;
  let titleMutation;

  beforeEach(() => {
    descriptionMutation = idleMutation();
    titleMutation = idleMutation();
    useGenerateListingDescriptionMutation.mockReturnValue(descriptionMutation);
    useGenerateListingSeoMutation.mockReturnValue(idleMutation());
    useGenerateListingTitleMutation.mockReturnValue(titleMutation);
    useGenerateListingAmenitiesMutation.mockReturnValue(idleMutation());
    useTranslateListingMutation.mockReturnValue(idleMutation());
    useGenerateListingFaqsMutation.mockReturnValue(idleMutation());
  });

  test('renders the heading and one row per tool', () => {
    render(<PartnerAiToolsPanel listingId={7} />);
    expect(screen.getByText('AI գրելու գործիքներ')).toBeInTheDocument();
    expect(screen.getByText('Նկարագրություն')).toBeInTheDocument();
    expect(screen.getByText('Հայտարարության վերնագիր')).toBeInTheDocument();
  });

  test('clicking Generate on the description tool calls its mutation with the listingId', async () => {
    const user = userEvent.setup();
    render(<PartnerAiToolsPanel listingId={7} />);

    const generateButtons = screen.getAllByRole('button', {
      name: 'Ստեղծել',
    });
    await user.click(generateButtons[0]);

    expect(descriptionMutation.mutate).toHaveBeenCalledWith(7);
  });

  test('the title tool includes the optional key-feature text in its mutation call', async () => {
    const user = userEvent.setup();
    render(<PartnerAiToolsPanel listingId={7} />);

    await user.type(
      screen.getByLabelText('Հիմնական առանձնահատկություն (ընտրովի)'),
      'rooftop pool',
    );
    const generateButtons = screen.getAllByRole('button', {
      name: 'Ստեղծել',
    });
    // Description, SEO, Title — title is the 3rd row.
    await user.click(generateButtons[2]);

    expect(titleMutation.mutate).toHaveBeenCalledWith({
      listingId: 7,
      keyFeature: 'rooftop pool',
    });
  });

  test('shows the generated content once a mutation resolves', () => {
    useGenerateListingDescriptionMutation.mockReturnValue(
      idleMutation({ data: { data: { content: 'A lovely hotel.' } } }),
    );
    render(<PartnerAiToolsPanel listingId={7} />);
    expect(screen.getByDisplayValue('A lovely hotel.')).toBeInTheDocument();
  });

  test('shows an inline error when a mutation fails', () => {
    useGenerateListingDescriptionMutation.mockReturnValue(
      idleMutation({ isError: true, error: { message: 'Boom' } }),
    );
    render(<PartnerAiToolsPanel listingId={7} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Boom');
  });
});
