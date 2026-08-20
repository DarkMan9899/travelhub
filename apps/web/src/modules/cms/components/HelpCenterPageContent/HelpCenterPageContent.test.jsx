import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HelpCenterPageContent from './HelpCenterPageContent.jsx';
import { getCmsPage } from '../../../../api/cms.js';

vi.mock('../../../../api/cms.js', () => ({ getCmsPage: vi.fn() }));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/hy/help']}>
        <Routes>
          <Route path="/:locale/help" element={<HelpCenterPageContent />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('HelpCenterPageContent (apps/web/src/modules/cms)', () => {
  beforeEach(() => {
    getCmsPage.mockReset();
  });

  test('renders the page heading and links to FAQ and Contact', () => {
    getCmsPage.mockRejectedValue(new Error('Not Found'));
    renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));
    expect(hrefs).toContain('/hy/faq');
    expect(hrefs).toContain('/hy/contact');
  });

  test('renders the CMS-authored title once the page is published', async () => {
    getCmsPage.mockResolvedValue({
      success: true,
      data: { title: 'CMS Help Title', content: 'CMS Help Lead' },
    });
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 1, name: 'CMS Help Title' }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText('CMS Help Lead')).toBeInTheDocument();
  });
});
