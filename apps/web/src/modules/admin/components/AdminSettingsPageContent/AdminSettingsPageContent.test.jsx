import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ToastProvider from '../../../../providers/ToastProvider.jsx';
import ConfirmProvider from '../../../../providers/ConfirmProvider.jsx';
import AdminSettingsPageContent from './AdminSettingsPageContent.jsx';
import * as adminApi from '../../../../api/admin.js';
import { useAuth } from '../../../../contexts/AuthContext.jsx';

vi.mock('../../../../contexts/AuthContext.jsx', () => ({ useAuth: vi.fn() }));
vi.mock('../../../../api/admin.js', () => ({
  getSettings: vi.fn(),
  createSetting: vi.fn(),
  updateSetting: vi.fn(),
  deleteSetting: vi.fn(),
  getFeatureFlags: vi.fn(),
  createFeatureFlag: vi.fn(),
  updateFeatureFlag: vi.fn(),
  deleteFeatureFlag: vi.fn(),
}));

const SETTING_ROWS = [
  {
    id: 1,
    key: 'site_name',
    value: 'desavii',
    description: 'Public display name.',
    updated_by: null,
    updated_at: '2026-08-01T00:00:00.000Z',
  },
];

const FLAG_ROWS = [
  {
    id: 1,
    code: 'maintenance_mode',
    name: 'Maintenance mode',
    description: 'Show a maintenance banner.',
    is_enabled: false,
    updated_at: '2026-08-01T00:00:00.000Z',
  },
];

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/hy/admin/settings']}>
        <ToastProvider>
          <ConfirmProvider>
            <Routes>
              <Route
                path="/:locale/admin/settings"
                element={<AdminSettingsPageContent />}
              />
            </Routes>
          </ConfirmProvider>
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminSettingsPageContent (apps/web/src/modules/admin)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminApi.getSettings.mockResolvedValue({ data: SETTING_ROWS });
    adminApi.getFeatureFlags.mockResolvedValue({ data: FLAG_ROWS });
    useAuth.mockReturnValue({ permissions: ['settings.manage'] });
  });

  test('lists the seeded settings under the System Settings tab', async () => {
    renderPage();
    expect(await screen.findByText('site_name')).toBeInTheDocument();
    expect(screen.getByText('"desavii"')).toBeInTheDocument();
  });

  test('switching to the Feature Flags tab lists flags with a toggle', async () => {
    renderPage();
    await screen.findByText('site_name');

    const user = userEvent.setup();
    await user.click(
      screen.getByRole('tab', { name: 'Հատկանիշների անջատիչներ' }),
    );

    expect(await screen.findByText('maintenance_mode')).toBeInTheDocument();
    expect(
      screen.getByRole('switch', { name: 'Փոխարկել Maintenance mode' }),
    ).not.toBeChecked();
  });

  test('creating a setting calls the API with the typed key/value and refetches the list', async () => {
    adminApi.createSetting.mockResolvedValue({
      data: {
        id: 2,
        key: 'new_setting',
        value: 'hello',
        description: null,
        updated_at: '2026-08-01T00:00:00.000Z',
      },
    });
    renderPage();
    await screen.findByText('site_name');

    const user = userEvent.setup();
    await user.click(
      screen.getByRole('button', { name: 'Ավելացնել կարգավորում' }),
    );
    await user.type(screen.getByLabelText(/^Բանալի/), 'new_setting');
    await user.type(screen.getByLabelText(/^Արժեք \(JSON\)/), '"hello"');
    await user.click(screen.getByRole('button', { name: 'Պահպանել' }));

    expect(adminApi.createSetting).toHaveBeenCalledWith({
      key: 'new_setting',
      value: 'hello',
      description: null,
    });
    expect(
      await screen.findByText('Կարգավորումը ստեղծվել է։'),
    ).toBeInTheDocument();
  });

  test('toggling a flag calls updateFeatureFlag with the flipped value', async () => {
    adminApi.updateFeatureFlag.mockResolvedValue({
      data: { ...FLAG_ROWS[0], is_enabled: true },
    });
    renderPage();
    const user = userEvent.setup();
    await user.click(
      screen.getByRole('tab', { name: 'Հատկանիշների անջատիչներ' }),
    );
    await screen.findByText('maintenance_mode');

    await user.click(
      screen.getByRole('switch', { name: 'Փոխարկել Maintenance mode' }),
    );

    expect(adminApi.updateFeatureFlag).toHaveBeenCalledWith(1, {
      code: 'maintenance_mode',
      name: 'Maintenance mode',
      description: 'Show a maintenance banner.',
      isEnabled: true,
    });
  });
});
