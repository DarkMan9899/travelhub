import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ToastProvider from '../../../../providers/ToastProvider.jsx';
import ConfirmProvider from '../../../../providers/ConfirmProvider.jsx';
import AdminCmsPageContent from './AdminCmsPageContent.jsx';
import * as cmsApi from '../../../../api/cms.js';
import { useAuth } from '../../../../contexts/AuthContext.jsx';

vi.mock('../../../../api/cms.js', () => ({
  getAdminCmsPages: vi.fn(),
  createCmsPage: vi.fn(),
  updateCmsPage: vi.fn(),
  deleteCmsPage: vi.fn(),
  upsertCmsTranslation: vi.fn(),
}));
vi.mock('../../../../contexts/AuthContext.jsx', () => ({ useAuth: vi.fn() }));

const PAGE_ROWS = [
  {
    id: 1,
    slug: 'about',
    is_published: true,
    updated_at: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 2,
    slug: 'blog',
    is_published: false,
    updated_at: '2026-08-01T00:00:00.000Z',
  },
];

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/hy/admin/cms']}>
        <ToastProvider>
          <ConfirmProvider>
            <Routes>
              <Route
                path="/:locale/admin/cms"
                element={<AdminCmsPageContent />}
              />
            </Routes>
          </ConfirmProvider>
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminCmsPageContent (apps/web/src/modules/admin)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cmsApi.getAdminCmsPages.mockResolvedValue({ data: PAGE_ROWS });
    useAuth.mockReturnValue({ permissions: ['cms.manage'] });
  });

  test('renders real seeded page rows with publish status', async () => {
    renderPage();
    expect(await screen.findByRole('link', { name: 'about' })).toHaveAttribute(
      'href',
      '/hy/admin/cms/1',
    );
    expect(screen.getByText('Հրապարակված')).toBeInTheDocument();
    expect(screen.getByText('Չհրապարակված')).toBeInTheDocument();
  });

  test('creating a page calls the API with the typed slug and refetches the list', async () => {
    cmsApi.createCmsPage.mockResolvedValue({
      data: { id: 3, slug: 'new-page', is_published: false },
    });
    renderPage();
    await screen.findByRole('link', { name: 'about' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Ավելացնել էջ' }));
    await user.type(screen.getByLabelText(/^Slug/), 'new-page');
    await user.click(screen.getByRole('button', { name: 'Պահպանել' }));

    await waitFor(() =>
      expect(cmsApi.createCmsPage).toHaveBeenCalledWith({
        slug: 'new-page',
        isPublished: false,
      }),
    );
    expect(await screen.findByText('Էջը ստեղծվել է։')).toBeInTheDocument();
  });

  test('deleting a page requires confirmation, then calls the API', async () => {
    cmsApi.deleteCmsPage.mockResolvedValue({});
    renderPage();
    await screen.findByRole('link', { name: 'about' });

    const user = userEvent.setup();
    const deleteButtons = screen.getAllByRole('button', { name: 'Ջնջել' });
    await user.click(deleteButtons[0]);

    expect(cmsApi.deleteCmsPage).not.toHaveBeenCalled();
    const confirmButtons = screen.getAllByRole('button', { name: 'Ջնջել' });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(cmsApi.deleteCmsPage).toHaveBeenCalledWith(1));
    expect(await screen.findByText('Էջը ջնջվել է։')).toBeInTheDocument();
  });
});
