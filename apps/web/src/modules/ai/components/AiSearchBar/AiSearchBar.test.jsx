import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AiSearchBar from './AiSearchBar.jsx';
import { useParseSearchQueryMutation } from '../../mutations/useParseSearchQueryMutation.js';

vi.mock('../../mutations/useParseSearchQueryMutation.js', () => ({
  useParseSearchQueryMutation: vi.fn(),
}));

const PARSE_RESPONSE = {
  data: {
    keyword: 'hotels with a pool',
    category_id: 5,
    category_name: 'Hotels',
    amenity_ids: [101],
  },
};

describe('AiSearchBar (apps/web/src/modules/ai)', () => {
  let mutate;

  beforeEach(() => {
    mutate = vi.fn((query, { onSuccess }) => onSuccess(PARSE_RESPONSE));
    useParseSearchQueryMutation.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
    });
  });

  test('submitting a query applies the parsed keyword/category/amenities to the caller', async () => {
    const onApply = vi.fn();
    const user = userEvent.setup();
    render(<AiSearchBar onApply={onApply} />);

    await user.type(
      screen.getByLabelText('Նկարագրեք, ինչ եք փնտրում'),
      'hotels with a pool in yerevan',
    );
    await user.click(screen.getByRole('button', { name: 'Փնտրել AI-ով' }));

    expect(mutate).toHaveBeenCalledWith(
      'hotels with a pool in yerevan',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(onApply).toHaveBeenCalledWith(
      {
        destination: 'hotels with a pool',
        categoryId: 5,
        dynamicFilters: { amenityIds: '101' },
      },
      { replace: false },
    );
  });

  test('does not submit an empty query', async () => {
    const onApply = vi.fn();
    render(<AiSearchBar onApply={onApply} />);
    expect(screen.getByRole('button', { name: 'Փնտրել AI-ով' })).toBeDisabled();
  });

  test('shows a submitting label and disables the button while pending', () => {
    useParseSearchQueryMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
      isError: false,
      error: null,
    });
    render(<AiSearchBar onApply={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Փնտրում է...' });
    expect(button).toBeDisabled();
  });

  test('a mutation error renders an inline error message', () => {
    useParseSearchQueryMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      error: { message: 'Boom' },
    });
    render(<AiSearchBar onApply={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Boom');
  });
});
