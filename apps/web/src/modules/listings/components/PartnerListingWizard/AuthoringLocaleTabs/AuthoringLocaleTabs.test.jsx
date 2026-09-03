import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import AuthoringLocaleTabs from './AuthoringLocaleTabs.jsx';

// A minimal stand-in for a real per-locale editor: mounts once, holds
// local state, and would lose that state on remount — the exact failure
// mode this component exists to prevent.
function StatefulChild() {
  const [count, setCount] = useState(0);
  return (
    <button type="button" onClick={() => setCount((c) => c + 1)}>
      count: {count}
    </button>
  );
}

function Harness() {
  const [activeLocale, setActiveLocale] = useState('en');
  return (
    <AuthoringLocaleTabs
      activeLocale={activeLocale}
      onChange={setActiveLocale}
      completionByLocale={{ hy: false, ru: true, en: false }}
      ariaLabel="Content language"
    >
      <StatefulChild />
    </AuthoringLocaleTabs>
  );
}

describe('AuthoringLocaleTabs (apps/web/src/modules/listings)', () => {
  test('shows a native-name label per locale with a completion glyph, not an invented score', () => {
    render(<Harness />);
    expect(screen.getByRole('tab', { name: 'Հայերեն ·' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Русский ✓' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'English ·' })).toBeInTheDocument();
  });

  test('switching the active tab does NOT remount children — local state survives', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /count: 0/ }));
    await user.click(screen.getByRole('button', { name: /count: 1/ }));
    expect(
      screen.getByRole('button', { name: /count: 2/ }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Հայերեն ·' }));
    // If this had remounted, the counter would be back to 0.
    expect(
      screen.getByRole('button', { name: /count: 2/ }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Русский ✓' }));
    expect(
      screen.getByRole('button', { name: /count: 2/ }),
    ).toBeInTheDocument();
  });

  test('calls onChange with the clicked locale code', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <AuthoringLocaleTabs
        activeLocale="en"
        onChange={onChange}
        completionByLocale={{ hy: false, ru: false, en: false }}
        ariaLabel="Content language"
      >
        <p>panel</p>
      </AuthoringLocaleTabs>,
    );
    await user.click(screen.getByRole('tab', { name: 'Русский ·' }));
    expect(onChange).toHaveBeenCalledWith('ru');
  });
});
