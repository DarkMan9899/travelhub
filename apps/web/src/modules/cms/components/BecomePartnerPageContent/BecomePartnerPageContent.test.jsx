import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BecomePartnerPageContent from './BecomePartnerPageContent.jsx';
import { getCmsPage } from '../../../../api/cms.js';

vi.mock('../../../../api/cms.js', () => ({ getCmsPage: vi.fn() }));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/hy/become-a-partner']}>
        <Routes>
          <Route
            path="/:locale/become-a-partner"
            element={<BecomePartnerPageContent />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('BecomePartnerPageContent (apps/web/src/modules/cms)', () => {
  beforeEach(() => {
    getCmsPage.mockReset();
  });

  test('renders the page heading, three benefits, and a single CTA button', () => {
    getCmsPage.mockRejectedValue(new Error('Not Found'));
    renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  test('renders the CMS-authored title once the page is published', async () => {
    getCmsPage.mockResolvedValue({
      success: true,
      data: { title: 'CMS Partner Title', content: 'CMS Partner Lead' },
    });
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 1, name: 'CMS Partner Title' }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText('CMS Partner Lead')).toBeInTheDocument();
  });
});
