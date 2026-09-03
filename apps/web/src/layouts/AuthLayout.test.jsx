import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AuthLayout from './AuthLayout.jsx';

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/en/auth/login']}>
      <Routes>
        <Route path="/:locale" element={<AuthLayout />}>
          <Route path="auth/login" element={<p>Login form</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AuthLayout (apps/web/src/layouts)', () => {
  test('renders the page content via the route outlet', () => {
    renderLayout();
    expect(screen.getByText('Login form')).toBeInTheDocument();
  });

  test('renders exactly two logo links back home — the desktop brand panel and the mobile-only one', () => {
    const { container } = renderLayout();
    const homeLinks = Array.from(container.querySelectorAll('a[href="/en"]'));
    expect(homeLinks).toHaveLength(2);
  });

  test('renders the real Home hero tagline in the brand panel — no invented marketing copy', () => {
    renderLayout();
    expect(
      screen.getByText(
        'Հյուրանոցներ, տուրեր, ռեստորաններ և փորձառություններ․ ամրագրեք ձեր հաջորդ ուղևորությունը Հայաստանում։',
      ),
    ).toBeInTheDocument();
  });
});
