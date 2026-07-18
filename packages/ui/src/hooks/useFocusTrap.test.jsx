import { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { describe, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import useFocusTrap from './useFocusTrap.js';

function Harness({ initialOpen, preventClose }) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const containerRef = useRef(null);
  useFocusTrap({
    containerRef,
    isOpen,
    onClose: () => setIsOpen(false),
    preventClose,
  });

  return (
    <div>
      <button type="button">Outside trigger</button>
      {isOpen && (
        <div ref={containerRef} data-testid="trapped">
          <button type="button">First</button>
          <button type="button">Last</button>
        </div>
      )}
    </div>
  );
}

Harness.propTypes = {
  initialOpen: PropTypes.bool,
  preventClose: PropTypes.bool,
};

Harness.defaultProps = {
  initialOpen: true,
  preventClose: false,
};

describe('useFocusTrap', () => {
  test('moves focus to the first focusable element inside the container on open', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
  });

  test('Tab from the last focusable element wraps to the first', () => {
    render(<Harness />);
    screen.getByRole('button', { name: 'Last' }).focus();

    fireEvent.keyDown(document, { key: 'Tab' });

    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
  });

  test('Shift+Tab from the first focusable element wraps to the last', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });

    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();
  });

  test('Escape closes the trap unless preventClose is set', () => {
    render(<Harness />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('trapped')).not.toBeInTheDocument();
  });

  test('preventClose blocks Escape from closing', () => {
    render(<Harness preventClose />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByTestId('trapped')).toBeInTheDocument();
  });

  test('restores focus to the previously focused element on close', () => {
    const outsideButtonHolder = document.createElement('button');
    document.body.appendChild(outsideButtonHolder);
    outsideButtonHolder.focus();

    render(<Harness />);
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(outsideButtonHolder).toHaveFocus();
    document.body.removeChild(outsideButtonHolder);
  });

  test('locks body scroll while open and restores it on close', () => {
    const { unmount } = render(<Harness />);
    expect(document.body.style.overflow).toBe('hidden');

    unmount();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  test('marks sibling content aria-hidden while open and restores it on close', () => {
    const sibling = document.createElement('div');
    document.body.appendChild(sibling);

    const { unmount } = render(<Harness />);
    expect(sibling).toHaveAttribute('aria-hidden', 'true');

    unmount();
    expect(sibling).not.toHaveAttribute('aria-hidden');
    document.body.removeChild(sibling);
  });

  test('does nothing when never opened', () => {
    render(<Harness initialOpen={false} />);
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});
