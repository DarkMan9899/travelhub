import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Section from './Section.jsx';

describe('Section (layout primitive)', () => {
  test('renders a native <section> by default', () => {
    const { container } = render(<Section>Content</Section>);
    expect(container.firstChild.tagName).toBe('SECTION');
  });

  test('becomes an accessible landmark once given an accessible name', () => {
    render(<Section aria-label="Featured listings">Content</Section>);
    expect(
      screen.getByRole('region', { name: 'Featured listings' }),
    ).toBeInTheDocument();
  });

  test('is polymorphic via the `as` prop', () => {
    const { container } = render(<Section as="div">Content</Section>);
    expect(container.firstChild.tagName).toBe('DIV');
  });

  test('spacing="none" applies a distinct class from the default', () => {
    const { container: withSpacing } = render(<Section>x</Section>);
    const { container: noSpacing } = render(
      <Section spacing="none">x</Section>,
    );
    expect(withSpacing.firstChild.className).not.toBe(
      noSpacing.firstChild.className,
    );
  });
});
