import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CompanyAvatar from './CompanyAvatar.jsx';

describe('CompanyAvatar (apps/web/src/components)', () => {
  test('renders the logo image when logoUrl is present', () => {
    const { container } = render(
      <CompanyAvatar name="Highland Experiences" logoUrl="/logo.png" />,
    );
    // Decorative image (alt=""), so it's excluded from the accessibility
    // tree's "img" role — check the DOM directly.
    expect(container.querySelector('img')).toHaveAttribute('src', '/logo.png');
  });

  test('falls back to two-letter initials over a procedural mesh when there is no logoUrl', () => {
    const { container } = render(<CompanyAvatar name="Highland Experiences" />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('HE')).toBeInTheDocument();
    expect(
      container.querySelector('[class*="avatar--mesh-"]'),
    ).toBeInTheDocument();
  });

  test('uses the first two letters of a single-word name', () => {
    render(<CompanyAvatar name="Desavii" />);
    expect(screen.getByText('DE')).toBeInTheDocument();
  });
});
