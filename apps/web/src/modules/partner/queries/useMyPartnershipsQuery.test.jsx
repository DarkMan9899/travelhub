import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PropTypes from 'prop-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMyPartnershipsQuery } from './useMyPartnershipsQuery.js';
import { getMyPartnerships } from '../../../api/partners.js';

vi.mock('../../../api/partners.js', () => ({
  getMyPartnerships: vi.fn(),
}));

function Harness({ enabled = true }) {
  const { data, isPending } = useMyPartnershipsQuery({ enabled });
  return (
    <div>
      <p data-testid="status">{isPending ? 'pending' : 'success'}</p>
      <p data-testid="slugs">
        {(data ?? []).map((membership) => membership.slug).join(',')}
      </p>
    </div>
  );
}

Harness.propTypes = { enabled: PropTypes.bool };

function renderHarness(enabled) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness enabled={enabled} />
    </QueryClientProvider>,
  );
}

describe('useMyPartnershipsQuery (apps/web/src/modules/partner)', () => {
  beforeEach(() => {
    getMyPartnerships.mockReset();
  });

  test('resolves the memberships array from the response envelope', async () => {
    getMyPartnerships.mockResolvedValue({
      data: [
        { partner_id: 1, slug: 'yerevan-boutique-hospitality', role: 'OWNER' },
      ],
    });
    renderHarness(true);

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(screen.getByTestId('slugs')).toHaveTextContent(
      'yerevan-boutique-hospitality',
    );
  });

  test('does not call the API while enabled is false', () => {
    renderHarness(false);
    expect(getMyPartnerships).not.toHaveBeenCalled();
  });
});
