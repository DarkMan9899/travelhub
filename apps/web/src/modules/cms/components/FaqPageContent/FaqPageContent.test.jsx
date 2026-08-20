import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FaqPageContent from './FaqPageContent.jsx';
import { getCmsPage } from '../../../../api/cms.js';

vi.mock('../../../../api/cms.js', () => ({ getCmsPage: vi.fn() }));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/hy/faq']}>
        <Routes>
          <Route path="/:locale/faq" element={<FaqPageContent />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('FaqPageContent (apps/web/src/modules/cms)', () => {
  beforeEach(() => {
    getCmsPage.mockReset();
  });

  test('renders the page heading and five collapsible questions', () => {
    getCmsPage.mockRejectedValue(new Error('Not Found'));
    const { container } = renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(container.querySelectorAll('details')).toHaveLength(5);
  });

  test('renders the CMS-authored title once the page is published', async () => {
    getCmsPage.mockResolvedValue({
      success: true,
      data: { title: 'CMS FAQ Title', content: 'CMS FAQ Lead' },
    });
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 1, name: 'CMS FAQ Title' }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText('CMS FAQ Lead')).toBeInTheDocument();
  });
});
