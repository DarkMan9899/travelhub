import { useState } from 'react';
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmProvider from './ConfirmProvider.jsx';
import { useConfirm } from '../contexts/ConfirmContext.jsx';

function Trigger() {
  const confirm = useConfirm();
  const [result, setResult] = useState(null);

  async function ask() {
    setResult(
      await confirm({
        title: 'Cancel booking?',
        description: 'This cannot be undone.',
      }),
    );
  }

  return (
    <>
      <button type="button" onClick={ask}>
        Ask
      </button>
      {result !== null && <p>Result: {String(result)}</p>}
    </>
  );
}

describe('ConfirmProvider (apps/web/src/providers)', () => {
  // The test harness's i18n instance defaults to Armenian (tests/setup.js)
  // — `common.confirm`/`common.cancel` render as "Հաստատել"/"Չեղարկել",
  // not the English button names, asserted against the real translations.
  test('resolves true when the user confirms', async () => {
    const user = userEvent.setup();
    render(
      <ConfirmProvider>
        <Trigger />
      </ConfirmProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Ask' }));
    expect(screen.getByText('Cancel booking?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Հաստատել' }));
    expect(await screen.findByText('Result: true')).toBeInTheDocument();
    expect(screen.queryByText('Cancel booking?')).not.toBeInTheDocument();
  });

  test('resolves false when the user cancels', async () => {
    const user = userEvent.setup();
    render(
      <ConfirmProvider>
        <Trigger />
      </ConfirmProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Ask' }));
    await user.click(screen.getByRole('button', { name: 'Չեղարկել' }));

    expect(await screen.findByText('Result: false')).toBeInTheDocument();
  });

  test('P2.2E: the dialog close (X) button uses a real, localized label, not the shared Modal default', async () => {
    const user = userEvent.setup();
    render(
      <ConfirmProvider>
        <Trigger />
      </ConfirmProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Ask' }));
    expect(screen.getByRole('button', { name: 'Փակել' })).toBeInTheDocument();
  });
});
