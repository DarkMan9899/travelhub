import { describe, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Showcase from './Showcase.jsx';

function renderShowcase(autoplay = false) {
  return render(
    <Showcase ariaLabel="Test carousel" autoplay={autoplay}>
      <p>Card one</p>
      <p>Card two</p>
      <p>Card three</p>
    </Showcase>,
  );
}

describe('Showcase (apps/web/src/modules/home)', () => {
  test('renders every child inside the carousel region', () => {
    renderShowcase();
    expect(screen.getByText('Card one')).toBeInTheDocument();
    expect(screen.getByText('Card two')).toBeInTheDocument();
    expect(screen.getByText('Card three')).toBeInTheDocument();
  });

  test('exposes a labeled carousel region', () => {
    renderShowcase();
    expect(
      screen.getByRole('group', { name: 'Test carousel' }),
    ).toBeInTheDocument();
  });

  // The prev/next arrows are laptop-and-up only by design (mobile relies
  // on swipe + the always-present dots) — jsdom's default test viewport
  // is narrower than that breakpoint, so they're only reachable via
  // `hidden: true`, same as `Header.test.jsx`'s desktop-nav case.
  // Accessible-name computation for a `hidden`-only match is a
  // `dom-accessibility-api`/jsdom quirk (resolves to "" instead of the
  // real `aria-label`) — same file's documented workaround: find by
  // class, assert the label as an attribute instead of a `getByRole`
  // `name` filter.
  test('renders previous/next navigation and pagination dots', () => {
    const { container } = renderShowcase();
    expect(
      container.querySelector('[class*="navButton--prev"]'),
    ).toHaveAttribute('aria-label', 'Նախորդը');
    expect(
      container.querySelector('[class*="navButton--next"]'),
    ).toHaveAttribute('aria-label', 'Հաջորդը');
    expect(
      screen.getAllByRole('button', { name: /Անցնել/ }).length,
    ).toBeGreaterThan(0);
  });

  test('prev/next/dot buttons are clickable without throwing', async () => {
    const user = userEvent.setup();
    const { container } = renderShowcase();

    // fireEvent (not userEvent) for prev/next: real, functional buttons,
    // but userEvent's realistic-interaction visibility check trips on
    // jsdom reporting them display:none at its default (sub-laptop) test
    // viewport width — the same jsdom/CSS breakpoint gap noted above,
    // not an actual bug in the handler being exercised.
    fireEvent.click(container.querySelector('[class*="navButton--next"]'));
    fireEvent.click(container.querySelector('[class*="navButton--prev"]'));
    await user.click(screen.getAllByRole('button', { name: /Անցնել/ })[0]);

    expect(screen.getByText('Card one')).toBeInTheDocument();
  });

  test('does not throw when autoplay is enabled', () => {
    expect(() => renderShowcase(true)).not.toThrow();
  });
});
