import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ContactPageContent from './ContactPageContent.jsx';
import { getCmsPage } from '../../../../api/cms.js';

vi.mock('../../../../api/cms.js', () => ({ getCmsPage: vi.fn() }));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/hy/contact']}>
        <Routes>
          <Route path="/:locale/contact" element={<ContactPageContent />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ContactPageContent (apps/web/src/modules/cms)', () => {
  beforeEach(() => {
    getCmsPage.mockReset();
    getCmsPage.mockRejectedValue(new Error('Not Found'));
  });

  test('renders the page heading and support email — no fabricated phone number', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByText('support@desavii.com')).toBeInTheDocument();
    expect(screen.queryByText('+374 10 000 000')).not.toBeInTheDocument();
    expect(screen.queryByText(/^\+374/)).not.toBeInTheDocument();
  });

  test('renders no submission form — contact is intentionally static', () => {
    renderPage();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('renders the CMS-authored title once the page is published', async () => {
    getCmsPage.mockResolvedValue({
      success: true,
      data: { title: 'CMS Contact Title', content: 'CMS Contact Lead' },
    });
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 1, name: 'CMS Contact Title' }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText('CMS Contact Lead')).toBeInTheDocument();
  });
});
