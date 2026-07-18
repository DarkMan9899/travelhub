import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sidebar from './Sidebar.jsx';

const ITEMS = [
  {
    id: 'main',
    label: 'Main',
    items: [
      { id: 'dashboard', label: 'Dashboard', href: '/dashboard' },
      {
        id: 'listings',
        label: 'Listings',
        href: '/dashboard/listings',
        badgeCount: 3,
      },
    ],
  },
];

describe('Sidebar (COMPONENT_LIBRARY.md Part II §3 "Sidebar Navigation")', () => {
  test('renders an aside region containing a labeled nav landmark', () => {
    render(<Sidebar items={ITEMS} ariaLabel="Partner navigation" />);
    expect(
      screen.getByRole('navigation', { name: 'Partner navigation' }),
    ).toBeInTheDocument();
  });

  test('renders each item as a link with its label as the accessible name', () => {
    render(<Sidebar items={ITEMS} />);
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });

  test('marks the active item with aria-current="page"', () => {
    render(<Sidebar items={ITEMS} activeItemId="listings" />);
    expect(screen.getByRole('link', { name: /Listings/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  test('renders a badge for items with a positive badgeCount', () => {
    render(<Sidebar items={ITEMS} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  test('collapsed mode still exposes each item label via aria-label even though visible text is hidden', () => {
    render(<Sidebar items={ITEMS} collapsed />);
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  test('the group label is hidden while collapsed', () => {
    const { rerender } = render(<Sidebar items={ITEMS} />);
    expect(screen.getByText('Main')).toBeInTheDocument();

    rerender(<Sidebar items={ITEMS} collapsed />);
    expect(screen.queryByText('Main')).not.toBeInTheDocument();
  });

  test('the collapse toggle button fires onToggleCollapse', async () => {
    const onToggleCollapse = vi.fn();
    const user = userEvent.setup();
    render(<Sidebar items={ITEMS} onToggleCollapse={onToggleCollapse} />);

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
  });

  test('renders no toggle button when onToggleCollapse is omitted', () => {
    render(<Sidebar items={ITEMS} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
