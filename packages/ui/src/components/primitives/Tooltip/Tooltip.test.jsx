import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Tooltip from './Tooltip.jsx';

function mockMatchMedia(matches) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

function advance(ms) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('Tooltip (COMPONENT_LIBRARY.md Part II §1)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('is hidden until triggered', () => {
    render(
      <Tooltip content="Add to favorites">
        <button type="button">Heart</button>
      </Tooltip>,
    );
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  test('shows on hover after the delay elapses, not before', () => {
    render(
      <Tooltip content="Add to favorites" delay={400}>
        <button type="button">Heart</button>
      </Tooltip>,
    );

    fireEvent.mouseEnter(screen.getByRole('button'));
    advance(300);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    advance(100);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Add to favorites');
  });

  test('shows on keyboard focus (not hover-only)', () => {
    render(
      <Tooltip content="Add to favorites" delay={0}>
        <button type="button">Heart</button>
      </Tooltip>,
    );

    fireEvent.focus(screen.getByRole('button'));
    advance(0);

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  test('hides on mouse leave and on blur', () => {
    render(
      <Tooltip content="Add to favorites" delay={0}>
        <button type="button">Heart</button>
      </Tooltip>,
    );
    const button = screen.getByRole('button');

    fireEvent.mouseEnter(button);
    advance(0);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.mouseLeave(button);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  test('links the trigger to the tooltip via aria-describedby while visible', () => {
    render(
      <Tooltip content="Add to favorites" delay={0}>
        <button type="button">Heart</button>
      </Tooltip>,
    );
    const button = screen.getByRole('button');

    fireEvent.focus(button);
    advance(0);

    const tooltip = screen.getByRole('tooltip');
    expect(button.getAttribute('aria-describedby')).toBe(tooltip.id);
  });

  test('never shows on a touch-only device, even on focus', () => {
    mockMatchMedia(true);
    render(
      <Tooltip content="Add to favorites" delay={0}>
        <button type="button">Heart</button>
      </Tooltip>,
    );

    fireEvent.focus(screen.getByRole('button'));
    advance(0);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
