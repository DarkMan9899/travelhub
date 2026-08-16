import { describe, test, expect } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import listingKeys from './queryKeys.js';

// Regression test for the Phase 9 invalidation bug: unit tests that only
// assert `invalidateQueries` was *called* with a given key (as the mutation
// tests do) still pass even when that key fails to match anything in a real
// cache. This test uses an actual QueryClient with a populated `mine(filters)`
// query and proves `mines()` (the key every listings-lifecycle mutation
// invalidates with) really does mark it invalidated — the previous `mine()`
// (called with no argument) silently did not.
describe('listingKeys.mines()/mine() (apps/web/src/modules/listings)', () => {
  test('mines() partially matches a populated mine(filters) cache entry', async () => {
    const queryClient = new QueryClient();
    const filters = { partnerId: 42, status: 'PUBLISHED' };

    await queryClient.fetchQuery({
      queryKey: listingKeys.mine(filters),
      queryFn: () => ({ items: [] }),
    });

    expect(
      queryClient.getQueryState(listingKeys.mine(filters)).isInvalidated,
    ).toBe(false);

    await queryClient.invalidateQueries({ queryKey: listingKeys.mines() });

    expect(
      queryClient.getQueryState(listingKeys.mine(filters)).isInvalidated,
    ).toBe(true);
  });

  test('mine() called with no argument does NOT match a populated mine(filters) cache entry', async () => {
    const queryClient = new QueryClient();
    const filters = { partnerId: 42, status: 'PUBLISHED' };

    await queryClient.fetchQuery({
      queryKey: listingKeys.mine(filters),
      queryFn: () => ({ items: [] }),
    });

    // Documents the exact failure mode fixed in this phase: `mine()` with
    // no argument still appends a `{ filters: undefined }` wrapper, which
    // does not partially match `{ filters: { partnerId, status } }`.
    await queryClient.invalidateQueries({ queryKey: listingKeys.mine() });

    expect(
      queryClient.getQueryState(listingKeys.mine(filters)).isInvalidated,
    ).toBe(false);
  });
});
