import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AppLayout from './AppLayout.jsx';

describe('AppLayout (apps/web/src/layouts)', () => {
  test('renders a skip link pointing at the main landmark', () => {
    render(<AppLayout>Page body</AppLayout>);
    const skipLink = screen.getAllByRole('link')[0];
    expect(skipLink).toHaveAttribute('href', '#main-content');
  });

  test('renders a <main> landmark with a matching, programmatically-focusable id', () => {
    render(<AppLayout>Page body</AppLayout>);
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main-content');
    expect(main).toHaveAttribute('tabIndex', '-1');
    expect(main).toHaveTextContent('Page body');
  });

  test('renders the header and footer slots when provided', () => {
    render(
      <AppLayout
        header={<header data-testid="header-slot" />}
        footer={<footer data-testid="footer-slot" />}
      >
        Page body
      </AppLayout>,
    );
    expect(screen.getByTestId('header-slot')).toBeInTheDocument();
    expect(screen.getByTestId('footer-slot')).toBeInTheDocument();
  });

  test('renders no header/footer chrome when the slots are omitted', () => {
    render(<AppLayout>Page body</AppLayout>);
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });
});
