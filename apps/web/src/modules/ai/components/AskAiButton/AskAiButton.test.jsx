import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AskAiButton from './AskAiButton.jsx';

vi.mock('../AiAssistantDrawer/AiAssistantDrawer.jsx', () => ({
  default: ({ isOpen, contextType, contextId, initialMessage }) =>
    isOpen ? (
      <div data-testid="assistant-drawer">
        {contextType ?? 'no-context-type'}:{contextId ?? 'no-context-id'}:
        {initialMessage ?? 'no-initial-message'}
      </div>
    ) : null,
}));

describe('AskAiButton (apps/web/src/modules/ai)', () => {
  test('renders the given label and opens the drawer with the given context on click', async () => {
    const user = userEvent.setup();
    render(
      <AskAiButton
        label="Ask AI about this listing"
        contextType="listing"
        contextId={101}
        initialMessage="Tell me about this listing."
      />,
    );

    expect(screen.queryByTestId('assistant-drawer')).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Ask AI about this listing' }),
    );

    expect(screen.getByTestId('assistant-drawer')).toHaveTextContent(
      'listing:101:Tell me about this listing.',
    );
  });

  test('opens with no context when only an initialMessage is given', async () => {
    const user = userEvent.setup();
    render(
      <AskAiButton
        label="Ask AI for optimization suggestions"
        initialMessage="What could I improve?"
      />,
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Ask AI for optimization suggestions',
      }),
    );

    expect(screen.getByTestId('assistant-drawer')).toHaveTextContent(
      'no-context-type:no-context-id:What could I improve?',
    );
  });
});
