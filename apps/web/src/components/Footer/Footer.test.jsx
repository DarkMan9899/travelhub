import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Footer from './Footer.jsx';

const COLUMNS = [
  {
    title: 'Company',
    links: [
      { label: 'About', to: '/about' },
      { label: 'Careers', to: '/careers' },
    ],
  },
  {
    title: 'Support',
    links: [{ label: 'Help Center', to: '/help' }],
  },
];

function renderFooter(props) {
  return render(
    <MemoryRouter>
      {/* eslint-disable-next-line react/jsx-props-no-spreading -- test helper forwards arbitrary Footer props */}
      <Footer {...props} />
    </MemoryRouter>,
  );
}

describe('Footer (apps/web/src/components)', () => {
  test('renders a footer landmark', () => {
    renderFooter();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  test('renders each column as a labeled nav landmark with its links', () => {
    renderFooter({ columns: COLUMNS });
    expect(
      screen.getByRole('navigation', { name: 'Company' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute(
      'href',
      '/about',
    );
    expect(
      screen.getByRole('navigation', { name: 'Support' }),
    ).toBeInTheDocument();
  });

  test('renders bottomText when provided', () => {
    renderFooter({ bottomText: '© 2026 Travel Hub Armenia' });
    expect(screen.getByText('© 2026 Travel Hub Armenia')).toBeInTheDocument();
  });

  test('renders no columns grid when columns is empty', () => {
    renderFooter();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});
