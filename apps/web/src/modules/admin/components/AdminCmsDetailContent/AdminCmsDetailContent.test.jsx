import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ToastProvider from '../../../../providers/ToastProvider.jsx';
import ConfirmProvider from '../../../../providers/ConfirmProvider.jsx';
import AdminCmsDetailContent from './AdminCmsDetailContent.jsx';
import * as cmsApi from '../../../../api/cms.js';
import { useAuth } from '../../../../contexts/AuthContext.jsx';

vi.mock('../../../../api/cms.js', () => ({
  getAdminCmsPages: vi.fn(),
  getAdminCmsPageDetail: vi.fn(),
  createCmsPage: vi.fn(),
  updateCmsPage: vi.fn(),
  deleteCmsPage: vi.fn(),
  upsertCmsTranslation: vi.fn(),
}));
vi.mock('../../../../contexts/AuthContext.jsx', () => ({ useAuth: vi.fn() }));

const PAGE_DETAIL = {
  id: 1,
  slug: 'about',
  is_published: true,
  translations: [
    {
      language_id: 1,
      language_code: 'hy',
      title: 'Մեր մասին',
      content: 'Բովանդակություն։',
    },
    {
      language_id: 2,
      language_code: 'en',
      title: 'About us',
      content: 'Content.',
    },
  ],
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/hy/admin/cms/1']}>
        <ToastProvider>
          <ConfirmProvider>
            <Routes>
              <Route
                path="/:locale/admin/cms/:id"
                element={<AdminCmsDetailContent />}
              />
            </Routes>
          </ConfirmProvider>
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminCmsDetailContent (apps/web/src/modules/admin)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cmsApi.getAdminCmsPageDetail.mockResolvedValue({ data: PAGE_DETAIL });
    useAuth.mockReturnValue({ permissions: ['cms.manage'] });
  });

  test('renders the page settings and every locale tab, defaulting to the first locale', async () => {
    renderPage();
    expect(await screen.findByDisplayValue('about')).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'HY', selected: true }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('Մեր մասին')).toBeInTheDocument();
  });

  test('saving the settings form calls updateCmsPage with the current slug/publish state', async () => {
    cmsApi.updateCmsPage.mockResolvedValue({
      data: { id: 1, slug: 'about', is_published: false },
    });
    renderPage();
    await screen.findByDisplayValue('about');

    const user = userEvent.setup();
    const publishedSwitch = screen.getByRole('switch', {
      name: 'Հրապարակված',
    });
    await user.click(publishedSwitch);

    const saveButtons = screen.getAllByRole('button', { name: 'Պահպանել' });
    await user.click(saveButtons[0]);

    await waitFor(() =>
      expect(cmsApi.updateCmsPage).toHaveBeenCalledWith(1, {
        slug: 'about',
        isPublished: false,
      }),
    );
    expect(
      await screen.findByText('Էջի կարգավորումները պահպանվել են։'),
    ).toBeInTheDocument();
  });

  test('switching to the EN tab and saving calls upsertCmsTranslation with languageCode "en"', async () => {
    cmsApi.upsertCmsTranslation.mockResolvedValue({ data: [] });
    renderPage();
    await screen.findByDisplayValue('about');

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'EN' }));
    expect(await screen.findByDisplayValue('About us')).toBeInTheDocument();

    const saveButtons = screen.getAllByRole('button', { name: 'Պահպանել' });
    await user.click(saveButtons[saveButtons.length - 1]);

    await waitFor(() =>
      expect(cmsApi.upsertCmsTranslation).toHaveBeenCalledWith(1, 'en', {
        title: 'About us',
        content: 'Content.',
      }),
    );
  });

  test('renders a 404 empty state for a genuine not-found error', async () => {
    cmsApi.getAdminCmsPageDetail.mockRejectedValue({ status: 404 });
    renderPage();
    expect(
      await screen.findByRole('heading', { name: 'Էջը չի գտնվել' }),
    ).toBeInTheDocument();
  });
});
