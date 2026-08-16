import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import LanguageSwitcher from './LanguageSwitcher.jsx';

function LocationDisplay() {
  const location = useLocation();
  return <p data-testid="path">{location.pathname}</p>;
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/:locale/*"
          element={
            <>
              <LanguageSwitcher />
              <LocationDisplay />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LanguageSwitcher (apps/web/src/components)', () => {
  test('marks the current locale as pressed', () => {
    renderAt('/hy/search');
    expect(screen.getByRole('button', { name: 'ՀՅ' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  test('switching locale rewrites only the leading path segment', async () => {
    const user = userEvent.setup();
    renderAt('/hy/search');

    await user.click(screen.getByRole('button', { name: 'EN' }));

    expect(screen.getByTestId('path')).toHaveTextContent('/en/search');
  });
});
