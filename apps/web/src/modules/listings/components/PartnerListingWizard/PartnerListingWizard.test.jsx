import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PartnerListingWizard from './PartnerListingWizard.jsx';
import { useListingQuery } from '../../queries/useListingQuery.js';
import { useListingMetadataQuery } from '../../queries/useListingMetadataQuery.js';
import { useToast } from '../../../../contexts/ToastContext.jsx';

vi.mock('../../queries/useListingQuery.js', () => ({
  useListingQuery: vi.fn(),
}));
vi.mock('../../queries/useListingMetadataQuery.js', () => ({
  useListingMetadataQuery: vi.fn(),
}));
vi.mock('../../../../contexts/ToastContext.jsx', () => ({
  useToast: vi.fn(),
}));

vi.mock('./steps/CategoryStep.jsx', () => ({
  default: () => <div>CategoryStep</div>,
}));
vi.mock('./steps/BasicInfoStep.jsx', () => ({
  default: () => <div>BasicInfoStep</div>,
}));
vi.mock('./steps/LocationStep.jsx', () => ({
  default: () => <div>LocationStep</div>,
}));
vi.mock('./steps/DynamicAttributesStep.jsx', () => ({
  default: () => <div>DynamicAttributesStep</div>,
}));
vi.mock('./steps/AmenitiesStep.jsx', () => ({
  default: () => <div>AmenitiesStep</div>,
}));
vi.mock('./steps/MediaStep.jsx', () => ({
  default: () => <div>MediaStep</div>,
}));
vi.mock('./steps/PricingStep.jsx', () => ({
  default: () => <div>PricingStep</div>,
}));
vi.mock('./steps/AvailabilityStep.jsx', () => ({
  default: () => <div>AvailabilityStep</div>,
}));
vi.mock('./steps/PoliciesStep.jsx', () => ({
  default: () => <div>PoliciesStep</div>,
}));
vi.mock('./steps/ContentStep.jsx', () => ({
  default: () => <div>ContentStep</div>,
}));
vi.mock('./steps/ReviewStep.jsx', () => ({
  default: () => <div>ReviewStep</div>,
}));

const PARTNERSHIPS = [{ partner_id: 1, display_name: 'Yerevan Boutique' }];

function renderWizard(initialEntry) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <PartnerListingWizard partnerships={PARTNERSHIPS} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PartnerListingWizard (orchestrator)', () => {
  test('renders CategoryStep by default with no listing yet', () => {
    useListingQuery.mockReturnValue({ data: undefined, isPending: false });
    useListingMetadataQuery.mockReturnValue({ data: undefined });
    useToast.mockReturnValue({ showToast: vi.fn() });

    renderWizard('/hy/partner/listings/new');
    expect(screen.getByText('CategoryStep')).toBeInTheDocument();
  });

  test('renders BasicInfoStep for ?step=basicInfo', () => {
    useListingQuery.mockReturnValue({ data: undefined, isPending: false });
    useListingMetadataQuery.mockReturnValue({ data: undefined });
    useToast.mockReturnValue({ showToast: vi.fn() });

    renderWizard('/hy/partner/listings/new?step=basicInfo');
    expect(screen.getByText('BasicInfoStep')).toBeInTheDocument();
  });

  test('redirects back to basicInfo when a later step is requested with no listingId', () => {
    useListingQuery.mockReturnValue({ data: undefined, isPending: false });
    useListingMetadataQuery.mockReturnValue({ data: undefined });
    useToast.mockReturnValue({ showToast: vi.fn() });

    renderWizard('/hy/partner/listings/new?step=media');
    expect(screen.getByText('BasicInfoStep')).toBeInTheDocument();
    expect(screen.queryByText('MediaStep')).not.toBeInTheDocument();
  });

  test('shows a PageLoader while the listing is still loading for a resumed draft', () => {
    useListingQuery.mockReturnValue({ data: undefined, isPending: true });
    useListingMetadataQuery.mockReturnValue({ data: undefined });
    useToast.mockReturnValue({ showToast: vi.fn() });

    renderWizard('/hy/partner/listings/new?listingId=7&step=media');
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('MediaStep')).not.toBeInTheDocument();
  });

  test('renders MediaStep once the resumed draft listing has loaded', () => {
    useListingQuery.mockReturnValue({
      data: {
        id: 7,
        category_ids: [3],
        translations: [{ title: 'Villa Ararat' }],
        media: [],
        attribute_values: [],
        policy_values: [],
        amenity_ids: [],
        location: null,
        pricing: null,
        booking_rules: null,
      },
      isPending: false,
    });
    useListingMetadataQuery.mockReturnValue({ data: undefined });
    useToast.mockReturnValue({ showToast: vi.fn() });

    renderWizard('/hy/partner/listings/new?listingId=7&step=media');
    expect(screen.getByText('MediaStep')).toBeInTheDocument();
  });

  test('renders ContentStep once the resumed draft listing has loaded', () => {
    useListingQuery.mockReturnValue({
      data: {
        id: 7,
        category_ids: [3],
        translations: [{ title: 'Villa Ararat' }],
        media: [],
        attribute_values: [],
        policy_values: [],
        amenity_ids: [],
        location: null,
        pricing: null,
        booking_rules: null,
        highlights: [],
        itinerary_steps: [],
        included_items: [],
        faqs: [],
      },
      isPending: false,
    });
    useListingMetadataQuery.mockReturnValue({ data: undefined });
    useToast.mockReturnValue({ showToast: vi.fn() });

    renderWizard('/hy/partner/listings/new?listingId=7&step=content');
    expect(screen.getByText('ContentStep')).toBeInTheDocument();
  });

  test('renders the WizardProgress step indicator', () => {
    useListingQuery.mockReturnValue({ data: undefined, isPending: false });
    useListingMetadataQuery.mockReturnValue({ data: undefined });
    useToast.mockReturnValue({ showToast: vi.fn() });

    renderWizard('/hy/partner/listings/new');
    expect(screen.getByText('Քայլ 1 11-ից. Կատեգորիա')).toBeInTheDocument();
  });
});
