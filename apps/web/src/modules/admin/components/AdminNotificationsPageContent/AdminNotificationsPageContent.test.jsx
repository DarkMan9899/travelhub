import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminNotificationsPageContent from './AdminNotificationsPageContent.jsx';

/* eslint-disable react/prop-types -- trivial test double, not a real component */
vi.mock('../../../notifications/index.js', () => ({
  NotificationsPageContent: ({ audience, breadcrumbs }) => (
    <div>
      mock-notifications-page-content audience={audience}
      {breadcrumbs?.map((crumb) => (
        <span key={crumb.href}>{crumb.label}</span>
      ))}
    </div>
  ),
}));
/* eslint-enable react/prop-types */
vi.mock('../AdminAnnouncementComposer/AdminAnnouncementComposer.jsx', () => ({
  default: () => <div>mock-announcement-composer</div>,
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/admin/notifications']}>
      <Routes>
        <Route
          path="/:locale/admin/notifications"
          element={<AdminNotificationsPageContent />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminNotificationsPageContent (apps/web/src/modules/admin)', () => {
  test('renders the announcement composer above the shared notifications list, scoped to the admin audience', () => {
    renderPage();

    expect(screen.getByText('mock-announcement-composer')).toBeInTheDocument();
    expect(
      screen.getByText(/mock-notifications-page-content/),
    ).toHaveTextContent('audience=admin');
  });

  test('passes a real Home/Dashboard/Notifications breadcrumb trail through to the shared component', () => {
    renderPage();

    expect(screen.getByText('Ծանուցումներ')).toBeInTheDocument();
  });
});
