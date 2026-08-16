import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NotificationPreferencesSection from './NotificationPreferencesSection.jsx';
import {
  listNotificationPreferences,
  updateNotificationPreference,
} from '../../../../api/notifications.js';

vi.mock('../../../../api/notifications.js', () => ({
  listNotificationPreferences: vi.fn(),
  updateNotificationPreference: vi.fn(),
}));

function renderSection() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationPreferencesSection />
    </QueryClientProvider>,
  );
}

describe('NotificationPreferencesSection (apps/web/src/modules/notifications)', () => {
  beforeEach(() => {
    listNotificationPreferences.mockReset();
    updateNotificationPreference.mockReset();
  });

  test('renders a switch pair per category', async () => {
    listNotificationPreferences.mockResolvedValue({
      data: [
        { category: 'BOOKING', in_app_enabled: true, email_enabled: true },
        { category: 'REVIEW', in_app_enabled: true, email_enabled: false },
      ],
    });
    renderSection();
    expect(await screen.findByText('Ամրագրումներ')).toBeInTheDocument();
    expect(screen.getByText('Կարծիքներ')).toBeInTheDocument();
    expect(screen.getAllByRole('switch')).toHaveLength(4);
  });

  test('toggling the email switch calls the update mutation with the flipped value only', async () => {
    listNotificationPreferences.mockResolvedValue({
      data: [
        { category: 'BOOKING', in_app_enabled: true, email_enabled: true },
      ],
    });
    updateNotificationPreference.mockResolvedValue({});
    renderSection();
    const user = userEvent.setup();

    const emailSwitches = await screen.findAllByRole('switch', {
      name: 'Էլ. փոստով',
    });
    await user.click(emailSwitches[0]);

    await waitFor(() =>
      expect(updateNotificationPreference).toHaveBeenCalledWith('BOOKING', {
        inAppEnabled: true,
        emailEnabled: false,
      }),
    );
  });

  test('shows a retryable error state when the request fails', async () => {
    listNotificationPreferences.mockRejectedValue(new Error('boom'));
    renderSection();
    expect(
      await screen.findByText('Չհաջողվեց բեռնել Ձեր նախապատվությունները'),
    ).toBeInTheDocument();
  });
});
