import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BlogPageContent from './BlogPageContent.jsx';
import { getCmsPage } from '../../../../api/cms.js';

vi.mock('../../../../api/cms.js', () => ({ getCmsPage: vi.fn() }));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/hy/blog']}>
        <Routes>
          <Route path="/:locale/blog" element={<BlogPageContent />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('BlogPageContent (apps/web/src/modules/cms)', () => {
  beforeEach(() => {
    getCmsPage.mockReset();
  });

  test('renders the page heading and an honest coming-soon empty state', () => {
    // The seeded `blog` CMS row is unpublished (404), matching real behavior.
    getCmsPage.mockRejectedValue(new Error('Not Found'));
    renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    // The empty state's title is the real Armenian "coming soon" string
    // (tests/setup.js defaults the i18n instance to Armenian).
    expect(screen.getByText('Շուտով')).toBeInTheDocument();
  });

  test('renders the CMS-authored title once the page is published', async () => {
    getCmsPage.mockResolvedValue({
      success: true,
      data: { title: 'CMS Blog Title', content: 'CMS Blog Description' },
    });
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 1, name: 'CMS Blog Title' }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText('CMS Blog Description')).toBeInTheDocument();
  });
});
