import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PropTypes from 'prop-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUploadAvatarMutation } from './useUploadAvatarMutation.js';
import { uploadAvatar } from '../../../api/users.js';
import { useAuth } from '../../../contexts/AuthContext.jsx';

vi.mock('../../../api/users.js', () => ({ uploadAvatar: vi.fn() }));
vi.mock('../../../contexts/AuthContext.jsx', () => ({ useAuth: vi.fn() }));

const FAKE_FILE = new File(['x'], 'avatar.png', { type: 'image/png' });

function Harness({ userId }) {
  const { mutate, isSuccess } = useUploadAvatarMutation(userId);
  return (
    <div>
      <button type="button" onClick={() => mutate(FAKE_FILE)}>
        upload
      </button>
      <p data-testid="status">{isSuccess ? 'success' : 'idle'}</p>
    </div>
  );
}
Harness.propTypes = { userId: PropTypes.number.isRequired };

describe('useUploadAvatarMutation (apps/web/src/modules/profile)', () => {
  let queryClient;
  let refreshUser;

  beforeEach(() => {
    uploadAvatar.mockReset();
    refreshUser = vi.fn().mockResolvedValue(undefined);
    useAuth.mockReturnValue({ refreshUser });
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
  });

  test('calls uploadAvatar then refreshes the session on success', async () => {
    uploadAvatar.mockResolvedValue({
      data: { id: 1, avatar_url: '/uploads/1.png' },
    });
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <Harness userId={1} />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'upload' }));

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(uploadAvatar).toHaveBeenCalledWith(1, FAKE_FILE);
    expect(refreshUser).toHaveBeenCalledTimes(1);
  });
});
