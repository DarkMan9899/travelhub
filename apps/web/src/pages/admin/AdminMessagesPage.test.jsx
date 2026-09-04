import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminMessagesPage from './AdminMessagesPage.jsx';

/* eslint-disable react/prop-types -- trivial test double, not a real component */
vi.mock('../../modules/messaging/index.js', () => ({
  MessagingPageContent: ({ breadcrumbs }) => (
    <div>
      mock-messaging-page-content
      {breadcrumbs?.map((crumb) => (
        <span key={crumb.href}>{crumb.label}</span>
      ))}
    </div>
  ),
}));
/* eslint-enable react/prop-types */

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/admin/messages']}>
      <Routes>
        <Route path="/:locale/admin/messages" element={<AdminMessagesPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminMessagesPage (apps/web/src/pages/admin)', () => {
  test('renders the shared messaging page with a real Home/Dashboard/Messages breadcrumb trail', () => {
    renderPage();

    expect(screen.getByText(/mock-messaging-page-content/)).toBeInTheDocument();
    expect(screen.getByText('Հաղորդագրություններ')).toBeInTheDocument();
  });
});
