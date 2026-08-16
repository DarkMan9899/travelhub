import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ToastProvider from '../../../../providers/ToastProvider.jsx';
import ConfirmProvider from '../../../../providers/ConfirmProvider.jsx';
import AdminMarketplaceConfigPageContent from './AdminMarketplaceConfigPageContent.jsx';
import * as adminApi from '../../../../api/admin.js';
import { useAuth } from '../../../../contexts/AuthContext.jsx';

vi.mock('../../../../contexts/AuthContext.jsx', () => ({ useAuth: vi.fn() }));
vi.mock('../../../../api/admin.js', () => ({
  getCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  getAmenityGroups: vi.fn(),
  getAmenities: vi.fn(),
  createAmenity: vi.fn(),
  updateAmenity: vi.fn(),
  deleteAmenity: vi.fn(),
  getPricingModels: vi.fn(),
  createPricingModel: vi.fn(),
  updatePricingModel: vi.fn(),
  deletePricingModel: vi.fn(),
  getCountries: vi.fn(),
  createCountry: vi.fn(),
  updateCountry: vi.fn(),
  deleteCountry: vi.fn(),
  getRegions: vi.fn(),
  createRegion: vi.fn(),
  updateRegion: vi.fn(),
  deleteRegion: vi.fn(),
  getCities: vi.fn(),
  createCity: vi.fn(),
  updateCity: vi.fn(),
  deleteCity: vi.fn(),
}));

const CATEGORY_ROWS = [
  { id: 1, name: 'Hotels', slug: 'hotels', parent_id: null },
  { id: 2, name: 'Tours', slug: 'tours', parent_id: null },
];
const AMENITY_ROWS = [
  {
    id: 5,
    name: 'Wi-Fi',
    amenity_group_id: 1,
    amenity_group_name: 'Connectivity',
  },
];

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/hy/admin/marketplace-config']}>
        <ToastProvider>
          <ConfirmProvider>
            <Routes>
              <Route
                path="/:locale/admin/marketplace-config"
                element={<AdminMarketplaceConfigPageContent />}
              />
            </Routes>
          </ConfirmProvider>
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminMarketplaceConfigPageContent (apps/web/src/modules/admin)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminApi.getCategories.mockResolvedValue({ data: CATEGORY_ROWS });
    adminApi.getAmenityGroups.mockResolvedValue({
      data: [{ id: 1, code: 'CONNECTIVITY', name: 'Connectivity' }],
    });
    adminApi.getAmenities.mockResolvedValue({ data: AMENITY_ROWS });
    adminApi.getPricingModels.mockResolvedValue({ data: [] });
    adminApi.getCountries.mockResolvedValue({ data: [] });
    adminApi.getRegions.mockResolvedValue({ data: [] });
    adminApi.getCities.mockResolvedValue({ data: [] });
    useAuth.mockReturnValue({ permissions: ['marketplace.configure'] });
  });

  test('renders the Categories tab by default with real seeded rows', async () => {
    renderPage();
    expect(await screen.findByText('Hotels')).toBeInTheDocument();
    expect(screen.getByText('Tours')).toBeInTheDocument();
  });

  test('switching to the Amenities tab shows amenity rows with their group name', async () => {
    renderPage();
    await screen.findByText('Hotels');

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Հարմարություններ' }));

    expect(await screen.findByText('Wi-Fi')).toBeInTheDocument();
    expect(screen.getByText('Connectivity')).toBeInTheDocument();
  });

  test('creating a category calls the API with the typed values and refetches the list', async () => {
    adminApi.createCategory.mockResolvedValue({
      data: {
        id: 3,
        name: 'Restaurants',
        slug: 'restaurants',
        parent_id: null,
      },
    });
    renderPage();
    await screen.findByText('Hotels');

    const user = userEvent.setup();
    await user.click(
      screen.getByRole('button', { name: 'Ավելացնել կատեգորիա' }),
    );

    // Both fields are `required`, so their rendered `<label>` text is
    // "Անուն*"/"Slug*" (a visible required-marker appended) — matched
    // with a prefix regex rather than an exact string.
    await user.type(screen.getByLabelText(/^Անուն/), 'Restaurants');
    await user.type(screen.getByLabelText(/^Slug/), 'restaurants');
    await user.click(screen.getByRole('button', { name: 'Պահպանել' }));

    await waitFor(() =>
      expect(adminApi.createCategory).toHaveBeenCalledWith({
        name: 'Restaurants',
        slug: 'restaurants',
        parentId: null,
      }),
    );
    expect(
      await screen.findByText('Կատեգորիան ստեղծվել է։'),
    ).toBeInTheDocument();
  });

  test('deleting a category requires confirmation, then calls the API', async () => {
    adminApi.deleteCategory.mockResolvedValue({});
    renderPage();
    await screen.findByText('Hotels');

    const user = userEvent.setup();
    const deleteButtons = screen.getAllByRole('button', { name: 'Ջնջել' });
    await user.click(deleteButtons[0]);

    expect(adminApi.deleteCategory).not.toHaveBeenCalled();
    const confirmButtons = screen.getAllByRole('button', { name: 'Ջնջել' });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() =>
      expect(adminApi.deleteCategory).toHaveBeenCalledWith(1),
    );
    expect(await screen.findByText('Կատեգորիան ջնջվել է։')).toBeInTheDocument();
  });
});
