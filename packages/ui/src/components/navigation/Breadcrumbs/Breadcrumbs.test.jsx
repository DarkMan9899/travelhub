import { describe, test, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import PropTypes from 'prop-types';
import Breadcrumbs from './Breadcrumbs.jsx';

function FakeRouterLink({ href, children }) {
  return (
    <a href={href} data-router-link="true">
      {children}
    </a>
  );
}

FakeRouterLink.propTypes = {
  href: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};

const ITEMS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Listings', href: '/dashboard/listings' },
  { label: 'Villa Ararat', href: '/dashboard/listings/villa-ararat' },
];

describe('Breadcrumbs (COMPONENT_LIBRARY.md Part II §3 "Breadcrumb")', () => {
  test('renders a nav landmark labeled "Breadcrumb"', () => {
    render(<Breadcrumbs items={ITEMS} />);
    expect(
      screen.getByRole('navigation', { name: 'Breadcrumb' }),
    ).toBeInTheDocument();
  });

  test('renders every non-final item as a real link', () => {
    render(<Breadcrumbs items={ITEMS} />);
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
    expect(screen.getByRole('link', { name: 'Listings' })).toHaveAttribute(
      'href',
      '/dashboard/listings',
    );
  });

  test('renders the final item as non-interactive with aria-current="page"', () => {
    render(<Breadcrumbs items={ITEMS} />);
    const current = screen.getByText('Villa Ararat');
    expect(current.tagName).not.toBe('A');
    expect(current).toHaveAttribute('aria-current', 'page');
  });

  test('collapses middle items into an ellipsis when exceeding maxItems', () => {
    const longTrail = [
      { label: 'A', href: '/a' },
      { label: 'B', href: '/a/b' },
      { label: 'C', href: '/a/b/c' },
      { label: 'D', href: '/a/b/c/d' },
      { label: 'E', href: '/a/b/c/d/e' },
    ];
    render(<Breadcrumbs items={longTrail} maxItems={3} />);

    expect(screen.getByRole('link', { name: 'A' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'B' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'C' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'D' })).toBeInTheDocument();
    expect(screen.getByText('E')).toHaveAttribute('aria-current', 'page');
  });

  test('does not collapse when items.length is within maxItems', () => {
    render(<Breadcrumbs items={ITEMS} maxItems={4} />);
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(nav).getAllByRole('link')).toHaveLength(2);
  });

  test('supports a custom linkComponent for router integration', () => {
    render(<Breadcrumbs items={ITEMS} linkComponent={FakeRouterLink} />);
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'data-router-link',
      'true',
    );
  });
});
