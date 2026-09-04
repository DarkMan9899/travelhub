import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminAiUsagePageContent from './AdminAiUsagePageContent.jsx';
import { useAdminAiUsageQuery } from '../../queries/useAdminAiUsageQuery.js';

vi.mock('../../queries/useAdminAiUsageQuery.js', () => ({
  useAdminAiUsageQuery: vi.fn(),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/admin/ai/usage']}>
      <Routes>
        <Route
          path="/:locale/admin/ai/usage"
          element={<AdminAiUsagePageContent />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminAiUsagePageContent (apps/web/src/modules/admin)', () => {
  test('shows the AI usage heading', () => {
    useAdminAiUsageQuery.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      refetch: vi.fn(),
    });
    renderPage();
    expect(
      screen.getByRole('heading', { name: 'AI օգտագործում' }),
    ).toBeInTheDocument();
  });

  test('shows a retryable error state on failure', async () => {
    const refetch = vi.fn();
    useAdminAiUsageQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch,
    });
    const user = userEvent.setup();
    renderPage();

    expect(
      screen.getByText('Ինչ-որ բան սխալ գնաց AI օգտագործումը բեռնելիս։'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Կրկին փորձել' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  test('renders real per-feature stats and recent-call rows, and computes overview tiles from them', () => {
    useAdminAiUsageQuery.mockReturnValue({
      data: {
        stats: [
          {
            feature_code: 'trip_planner',
            provider_code: 'local',
            call_count: 3,
            total_tokens: 900,
            cache_hits: 1,
            failure_count: 1,
            avg_latency_ms: 120,
          },
        ],
        recent: [
          {
            id: 1,
            user_id: 3,
            partner_id: null,
            feature_code: 'trip_planner',
            provider_code: 'local',
            model: null,
            total_tokens: 300,
            latency_ms: 110,
            cache_hit: false,
            succeeded: true,
            created_at: '2026-08-01T10:00:00.000Z',
          },
        ],
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderPage();

    expect(
      screen.getAllByText('Ճամփորդության պլանավորիչ').length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText('Տեղային (սիմուլյացված)').length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText('trip_planner')).not.toBeInTheDocument();
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
    expect(screen.getAllByText('900').length).toBeGreaterThan(0);
    expect(screen.getByText('300')).toBeInTheDocument();
    expect(screen.getByText('110')).toBeInTheDocument();
    expect(screen.getByText('Հաջողվեց')).toBeInTheDocument();
  });

  test('an unmapped feature/provider code falls back to the raw code, never a blank cell', () => {
    useAdminAiUsageQuery.mockReturnValue({
      data: {
        stats: [
          {
            feature_code: 'future_feature',
            provider_code: 'future_provider',
            call_count: 1,
            total_tokens: 10,
            cache_hits: 0,
            failure_count: 0,
            avg_latency_ms: 50,
          },
        ],
        recent: [],
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderPage();

    expect(screen.getByText('future_feature')).toBeInTheDocument();
    expect(screen.getByText('future_provider')).toBeInTheDocument();
  });
});
