import { describe, test, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAdminListFilters } from './useAdminListFilters.js';

const DEFAULTS = { keyword: '', status: '' };

function wrapper({ children }) {
  return <MemoryRouter initialEntries={['/']}>{children}</MemoryRouter>;
}

describe('useAdminListFilters', () => {
  test('starts with the given defaults when the URL has no query params', () => {
    const { result } = renderHook(() => useAdminListFilters(DEFAULTS), {
      wrapper,
    });
    expect(result.current.filters).toEqual(DEFAULTS);
  });

  test('updateFilters writes a non-default value into the URL-synced state', () => {
    const { result } = renderHook(() => useAdminListFilters(DEFAULTS), {
      wrapper,
    });
    act(() => {
      result.current.updateFilters({ keyword: 'anna' });
    });
    expect(result.current.filters).toEqual({ keyword: 'anna', status: '' });
  });

  test('setting a filter back to its default value omits it from state again', () => {
    const { result } = renderHook(() => useAdminListFilters(DEFAULTS), {
      wrapper,
    });
    act(() => {
      result.current.updateFilters({ status: 'SUSPENDED' });
    });
    expect(result.current.filters.status).toBe('SUSPENDED');

    act(() => {
      result.current.updateFilters({ status: '' });
    });
    expect(result.current.filters.status).toBe('');
  });
});
