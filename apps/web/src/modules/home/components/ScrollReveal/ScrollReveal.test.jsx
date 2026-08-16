import { describe, test, expect, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScrollReveal from './ScrollReveal.jsx';

function mockMatchMedia(matches) {
  // Framer Motion's own internal reduced-motion detection still uses the
  // legacy MediaQueryList.addListener/removeListener API (not just
  // addEventListener) — both must be present or mounting a `motion.*`
  // element throws.
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
}

describe('ScrollReveal (apps/web/src/modules/home)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('renders its children', () => {
    mockMatchMedia(false);
    render(
      <ScrollReveal>
        <p>Section content</p>
      </ScrollReveal>,
    );
    expect(screen.getByText('Section content')).toBeInTheDocument();
  });

  test('renders a plain, non-animated wrapper when reduced motion is preferred', () => {
    mockMatchMedia(true);
    const { container } = render(
      <ScrollReveal>
        <p>Section content</p>
      </ScrollReveal>,
    );
    expect(screen.getByText('Section content')).toBeInTheDocument();
    expect(container.firstChild.tagName).toBe('DIV');
  });

  test('stagger mode renders every child, each independently', () => {
    mockMatchMedia(false);
    render(
      <ScrollReveal stagger>
        <p>First</p>
        <p>Second</p>
        <p>Third</p>
      </ScrollReveal>,
    );
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(screen.getByText('Third')).toBeInTheDocument();
  });

  test('stagger mode still renders a plain wrapper under reduced motion', () => {
    mockMatchMedia(true);
    render(
      <ScrollReveal stagger>
        <p>First</p>
        <p>Second</p>
      </ScrollReveal>,
    );
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });
});
