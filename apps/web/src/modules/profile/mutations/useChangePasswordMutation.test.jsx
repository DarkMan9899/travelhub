import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PropTypes from 'prop-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useChangePasswordMutation } from './useChangePasswordMutation.js';
import { changePassword } from '../../../api/users.js';

vi.mock('../../../api/users.js', () => ({ changePassword: vi.fn() }));

function Harness({ userId }) {
  const { mutate, isSuccess } = useChangePasswordMutation(userId);
  return (
    <div>
      <button
        type="button"
        onClick={() =>
          mutate({ currentPassword: 'Old!12345', newPassword: 'New!123456' })
        }
      >
        change
      </button>
      <p data-testid="status">{isSuccess ? 'success' : 'idle'}</p>
    </div>
  );
}
Harness.propTypes = { userId: PropTypes.number.isRequired };

describe('useChangePasswordMutation (apps/web/src/modules/profile)', () => {
  let queryClient;

  beforeEach(() => {
    changePassword.mockReset();
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
  });

  test('calls changePassword with the userId and both passwords', async () => {
    changePassword.mockResolvedValue({ data: { changed: true } });
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <Harness userId={1} />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'change' }));

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(changePassword).toHaveBeenCalledWith(1, {
      currentPassword: 'Old!12345',
      newPassword: 'New!123456',
    });
  });
});
