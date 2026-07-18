import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Header from './Header.jsx';

const NAV_ITEMS = [
  { label: 'Home', to: '/hy' },
  { label: 'Search', to: '/hy/search' },
];

function renderHeader(props) {
  return render(
    <MemoryRouter>
      {/* eslint-disable-next-line react/jsx-props-no-spreading -- test helper forwards arbitrary Header props */}
      <Header logo="Travel Hub Armenia" {...props} />
    </MemoryRouter>,
  );
}

describe('Header (apps/web/src/components)', () => {
  test('renders a header landmark with a home link', () => {
    renderHeader();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Travel Hub Armenia' }),
    ).toHaveAttribute('href', '/');
  });

  test('renders navItems inside a labeled Primary nav landmark', () => {
    renderHeader({ navItems: NAV_ITEMS });
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Search' })).toHaveAttribute(
      'href',
      '/hy/search',
    );
  });

  test('renders no nav landmark when navItems is empty', () => {
    renderHeader();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  test('renders an actions slot when provided', () => {
    renderHeader({ actions: <button type="button">Sign in</button> });
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });
});
