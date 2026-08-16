import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PropTypes from 'prop-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUpdateProfileMutation } from './useUpdateProfileMutation.js';
import { updateProfile } from '../../../api/users.js';
import { useAuth } from '../../../contexts/AuthContext.jsx';

vi.mock('../../../api/users.js', () => ({ updateProfile: vi.fn() }));
vi.mock('../../../contexts/AuthContext.jsx', () => ({ useAuth: vi.fn() }));

function Harness({ userId }) {
  const { mutate, isSuccess } = useUpdateProfileMutation(userId);
  return (
    <div>
      <button type="button" onClick={() => mutate({ firstName: 'New' })}>
        save
      </button>
      <p data-testid="status">{isSuccess ? 'success' : 'idle'}</p>
    </div>
  );
}
Harness.propTypes = { userId: PropTypes.number.isRequired };

describe('useUpdateProfileMutation (apps/web/src/modules/profile)', () => {
  let queryClient;
  let refreshUser;

  beforeEach(() => {
    updateProfile.mockReset();
    refreshUser = vi.fn().mockResolvedValue(undefined);
    useAuth.mockReturnValue({ refreshUser });
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
  });

  test('calls updateProfile then refreshes the session on success', async () => {
    updateProfile.mockResolvedValue({ data: { id: 1, first_name: 'New' } });
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <Harness userId={1} />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(updateProfile).toHaveBeenCalledWith(1, { firstName: 'New' });
    expect(refreshUser).toHaveBeenCalledTimes(1);
  });
});
