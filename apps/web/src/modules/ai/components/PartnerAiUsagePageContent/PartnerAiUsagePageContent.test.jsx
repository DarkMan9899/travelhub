import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PartnerAiUsagePageContent from './PartnerAiUsagePageContent.jsx';
import { usePartnerContext } from '../../../../contexts/PartnerContext.jsx';
import { usePartnerAiUsageQuery } from '../../queries/usePartnerAiUsageQuery.js';

vi.mock('../../../../contexts/PartnerContext.jsx', () => ({
  usePartnerContext: vi.fn(),
}));
vi.mock('../../queries/usePartnerAiUsageQuery.js', () => ({
  usePartnerAiUsageQuery: vi.fn(),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/partner/ai/usage']}>
      <Routes>
        <Route
          path="/:locale/partner/ai/usage"
          element={<PartnerAiUsagePageContent />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PartnerAiUsagePageContent (apps/web/src/modules/ai)', () => {
  test('queries usage scoped to the active partnership', () => {
    usePartnerContext.mockReturnValue({ activePartnerId: 7 });
    usePartnerAiUsageQuery.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      refetch: vi.fn(),
    });
    renderPage();

    expect(usePartnerAiUsageQuery).toHaveBeenCalledWith(7);
    expect(
      screen.getByRole('heading', { name: 'AI օգտագործում' }),
    ).toBeInTheDocument();
  });

  test('shows a retryable error state on failure', async () => {
    usePartnerContext.mockReturnValue({ activePartnerId: 7 });
    const refetch = vi.fn();
    usePartnerAiUsageQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch,
    });
    renderPage();

    expect(
      screen.getByText('Ինչ-որ բան սխալ գնաց AI օգտագործումը բեռնելիս։'),
    ).toBeInTheDocument();
  });

  test('renders real per-feature stats scoped to this partner only', () => {
    usePartnerContext.mockReturnValue({ activePartnerId: 7 });
    usePartnerAiUsageQuery.mockReturnValue({
      data: {
        stats: [
          {
            feature_code: 'listing_description',
            provider_code: 'local',
            call_count: 5,
            total_tokens: 400,
            cache_hits: 2,
            failure_count: 0,
            avg_latency_ms: 90,
          },
        ],
        recent: [],
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderPage();

    expect(screen.getByText('listing_description')).toBeInTheDocument();
    expect(screen.getAllByText('local').length).toBeGreaterThan(0);
    expect(screen.getAllByText('5').length).toBeGreaterThan(0);
  });
});
