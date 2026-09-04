import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminAiModerationPageContent from './AdminAiModerationPageContent.jsx';
import { useAdminAiModerationQueueQuery } from '../../queries/useAdminAiModerationQueueQuery.js';
import { useScoreListingMutation } from '../../mutations/useScoreListingMutation.js';

vi.mock('../../queries/useAdminAiModerationQueueQuery.js', () => ({
  useAdminAiModerationQueueQuery: vi.fn(),
}));
vi.mock('../../mutations/useScoreListingMutation.js', () => ({
  useScoreListingMutation: vi.fn(),
}));

function idleMutation(overrides = {}) {
  return {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    data: undefined,
    variables: undefined,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/admin/ai/moderation']}>
      <Routes>
        <Route
          path="/:locale/admin/ai/moderation"
          element={<AdminAiModerationPageContent />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminAiModerationPageContent (apps/web/src/modules/admin)', () => {
  test('shows the AI moderation heading', () => {
    useAdminAiModerationQueueQuery.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      refetch: vi.fn(),
    });
    useScoreListingMutation.mockReturnValue(idleMutation());
    renderPage();
    expect(
      screen.getByRole('heading', { name: 'AI մոդերացիա' }),
    ).toBeInTheDocument();
  });

  test('shows a retryable error state on failure', async () => {
    const refetch = vi.fn();
    useAdminAiModerationQueueQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch,
    });
    useScoreListingMutation.mockReturnValue(idleMutation());
    const user = userEvent.setup();
    renderPage();

    expect(
      screen.getByText('Ինչ-որ բան սխալ գնաց մոդերացիայի հերթը բեռնելիս։'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Կրկին փորձել' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  test('renders a queue row with real signals translated', () => {
    useAdminAiModerationQueueQuery.mockReturnValue({
      data: [
        {
          listing_id: 42,
          title: 'Cozy Downtown Apartment',
          partner_display_name: 'Test Partner',
          score: 75,
          signals: ['TITLE_ALL_CAPS', 'POSSIBLE_DUPLICATE_TITLE'],
        },
      ],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    useScoreListingMutation.mockReturnValue(idleMutation());
    renderPage();

    expect(screen.getByText('Cozy Downtown Apartment')).toBeInTheDocument();
    expect(screen.getByText('Test Partner')).toBeInTheDocument();
    expect(
      screen.getByText('Վերնագիրը մեծատառերով, Հնարավոր կրկնվող վերնագիր'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Դիտել հայտարարությունը' }),
    ).toHaveAttribute('href', '/hy/admin/listings/42');
  });

  test('clicking Score calls the mutation with the real listing id', async () => {
    useAdminAiModerationQueueQuery.mockReturnValue({
      data: [
        {
          listing_id: 42,
          title: 'Cozy Downtown Apartment',
          partner_display_name: 'Test Partner',
          score: 75,
          signals: ['TITLE_ALL_CAPS'],
        },
      ],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    const mutate = vi.fn();
    useScoreListingMutation.mockReturnValue(idleMutation({ mutate }));
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Գնահատել' }));
    expect(mutate).toHaveBeenCalledWith(42);
  });

  test('shows the real heuristic score and AI note once scoring resolves', () => {
    useAdminAiModerationQueueQuery.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    useScoreListingMutation.mockReturnValue(
      idleMutation({
        variables: 42,
        data: {
          data: {
            listing_id: 42,
            heuristic_score: 55,
            signals: ['DESCRIPTION_TOO_SHORT'],
            ai_note: 'Likely needs manual review.',
          },
        },
      }),
    );
    renderPage();

    expect(screen.getByText('Հայտարարության գնահատական')).toBeInTheDocument();
    expect(screen.getByText('55')).toBeInTheDocument();
    expect(screen.getByText('Նկարագրությունը շատ կարճ է')).toBeInTheDocument();
    expect(screen.getByText('Likely needs manual review.')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Դիտել հայտարարությունը' }),
    ).toHaveAttribute('href', '/hy/admin/listings/42');
  });

  test('AI Moderation never writes a moderation decision itself — no approve/reject control exists on this page', () => {
    useAdminAiModerationQueueQuery.mockReturnValue({
      data: [
        {
          listing_id: 42,
          title: 'Cozy Downtown Apartment',
          partner_display_name: 'Test Partner',
          score: 75,
          signals: ['TITLE_ALL_CAPS'],
        },
      ],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    useScoreListingMutation.mockReturnValue(idleMutation());
    renderPage();

    expect(
      screen.queryByRole('button', { name: /approve/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /reject/i }),
    ).not.toBeInTheDocument();
  });
});
