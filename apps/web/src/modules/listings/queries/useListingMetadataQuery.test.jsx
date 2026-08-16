import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PropTypes from 'prop-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useListingMetadataQuery } from './useListingMetadataQuery.js';
import { getListingMetadata } from '../../../api/listings.js';

vi.mock('../../../api/listings.js', () => ({
  getListingMetadata: vi.fn(),
}));

function Harness({ categoryId = undefined, locale = undefined }) {
  const { data, isPending } = useListingMetadataQuery(categoryId, locale);
  return (
    <div>
      <p data-testid="status">{isPending ? 'pending' : 'success'}</p>
      <p data-testid="attributeCodes">
        {(data?.attributes ?? []).map((attribute) => attribute.code).join(',')}
      </p>
    </div>
  );
}

Harness.propTypes = {
  categoryId: PropTypes.number,
  locale: PropTypes.string,
};

function renderHarness(categoryId, locale) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness categoryId={categoryId} locale={locale} />
    </QueryClientProvider>,
  );
}

describe('useListingMetadataQuery (apps/web/src/modules/listings)', () => {
  beforeEach(() => {
    getListingMetadata.mockReset();
  });

  test('resolves category-scoped metadata from the response envelope', async () => {
    getListingMetadata.mockResolvedValue({
      data: {
        attributes: [{ code: 'bedrooms' }, { code: 'bathrooms' }],
        amenity_groups: [],
        pricing_models: [],
        policies: [],
      },
    });
    renderHarness(3, 'hy');

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(screen.getByTestId('attributeCodes')).toHaveTextContent(
      'bedrooms,bathrooms',
    );
    expect(getListingMetadata).toHaveBeenCalledWith(3, 'hy');
  });

  test('a different categoryId is a different query key (real backend refetch)', async () => {
    getListingMetadata
      .mockResolvedValueOnce({
        data: {
          attributes: [{ code: 'bedrooms' }],
          amenity_groups: [],
          pricing_models: [],
          policies: [],
        },
      })
      .mockResolvedValueOnce({
        data: {
          attributes: [{ code: 'duration' }],
          amenity_groups: [],
          pricing_models: [],
          policies: [],
        },
      });

    const { rerender } = renderHarness(3);
    await waitFor(() =>
      expect(screen.getByTestId('attributeCodes')).toHaveTextContent(
        'bedrooms',
      ),
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    rerender(
      <QueryClientProvider client={queryClient}>
        <Harness categoryId={9} />
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('attributeCodes')).toHaveTextContent(
        'duration',
      ),
    );
    expect(getListingMetadata).toHaveBeenCalledWith(9, undefined);
  });

  test('stays disabled (never calls the API) when no categoryId is selected yet', () => {
    renderHarness(undefined);
    expect(getListingMetadata).not.toHaveBeenCalled();
  });
});
