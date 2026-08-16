import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AiAssistantDrawer from './AiAssistantDrawer.jsx';
import { streamAssistantMessage } from '../../../../api/aiStreamClient.js';
import { askAssistant } from '../../../../api/ai.js';

vi.mock('../../../../api/aiStreamClient.js', () => ({
  streamAssistantMessage: vi.fn(),
}));
vi.mock('../../../../api/ai.js', () => ({
  askAssistant: vi.fn(),
}));

// The test harness's i18n instance defaults to Armenian (tests/setup.js) —
// real "ai.assistant.*" content, matched here rather than English strings.
const SEND_BUTTON_NAME = 'Ուղարկել';
const INPUT_LABEL = 'Ձեր հաղորդագրությունը';
const EMPTY_TEXT =
  'Հարցրեք ձեր ուղևորության, հայտարարության կամ ամրագրման մասին։';

function renderDrawer() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AiAssistantDrawer isOpen onClose={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe('AiAssistantDrawer (apps/web/src/modules/ai)', () => {
  beforeEach(() => {
    streamAssistantMessage.mockReset();
    askAssistant.mockReset();
  });

  test('shows the empty state before any message is sent', () => {
    renderDrawer();
    expect(screen.getByText(EMPTY_TEXT)).toBeInTheDocument();
  });

  test('streams the assistant reply token-by-token and appends it', async () => {
    streamAssistantMessage.mockImplementation(async function* mockStream() {
      yield { delta: 'Hello', done: false };
      yield { delta: ' there', done: false };
      yield { delta: '', done: true, conversationId: 42 };
    });
    const user = userEvent.setup();
    renderDrawer();

    await user.type(screen.getByLabelText(INPUT_LABEL), 'Hi');
    await user.click(screen.getByRole('button', { name: SEND_BUTTON_NAME }));

    expect(await screen.findByText('Hello there')).toBeInTheDocument();
    expect(streamAssistantMessage).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Hi' }),
    );
  });

  test('falls back to the synchronous route when streaming yields no chunks', async () => {
    // eslint-disable-next-line require-yield, no-empty-function -- deliberate: simulates a stream that never yields
    streamAssistantMessage.mockImplementation(async function* mockStream() {
      // intentionally empty
    });
    askAssistant.mockResolvedValue({
      data: { conversation_id: 7, message: 'Fallback reply' },
    });
    const user = userEvent.setup();
    renderDrawer();

    await user.type(screen.getByLabelText(INPUT_LABEL), 'Hi');
    await user.click(screen.getByRole('button', { name: SEND_BUTTON_NAME }));

    expect(await screen.findByText('Fallback reply')).toBeInTheDocument();
  });

  test('falls back to the synchronous route when streaming throws', async () => {
    // eslint-disable-next-line require-yield -- deliberate: throws before ever yielding
    streamAssistantMessage.mockImplementation(async function* mockStream() {
      throw new Error('network down');
    });
    askAssistant.mockResolvedValue({
      data: { conversation_id: 7, message: 'Fallback after failure' },
    });
    const user = userEvent.setup();
    renderDrawer();

    await user.type(screen.getByLabelText(INPUT_LABEL), 'Hi');
    await user.click(screen.getByRole('button', { name: SEND_BUTTON_NAME }));

    expect(
      await screen.findByText('Fallback after failure'),
    ).toBeInTheDocument();
  });

  test('shows an inline error and removes the pending bubble when both routes fail', async () => {
    // eslint-disable-next-line require-yield -- deliberate: throws before ever yielding
    streamAssistantMessage.mockImplementation(async function* mockStream() {
      throw new Error('network down');
    });
    askAssistant.mockRejectedValue({ message: 'Boom' });
    const user = userEvent.setup();
    renderDrawer();

    await user.type(screen.getByLabelText(INPUT_LABEL), 'Hi');
    await user.click(screen.getByRole('button', { name: SEND_BUTTON_NAME }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Boom');
    await waitFor(() => expect(screen.getByText('Hi')).toBeInTheDocument());
  });

  test('does not submit an empty message', () => {
    renderDrawer();
    expect(
      screen.getByRole('button', { name: SEND_BUTTON_NAME }),
    ).toBeDisabled();
  });

  test('passes contextType/contextId through on the first message only', async () => {
    streamAssistantMessage.mockImplementation(async function* mockStream() {
      yield { delta: 'ok', done: false };
      yield { delta: '', done: true, conversationId: 42 };
    });
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <AiAssistantDrawer
          isOpen
          onClose={vi.fn()}
          contextType="listing"
          contextId={101}
        />
      </QueryClientProvider>,
    );

    await user.type(screen.getByLabelText(INPUT_LABEL), 'Hi');
    await user.click(screen.getByRole('button', { name: SEND_BUTTON_NAME }));
    await screen.findByText('ok');

    expect(streamAssistantMessage).toHaveBeenCalledWith(
      expect.objectContaining({ contextType: 'listing', contextId: 101 }),
    );

    await user.type(screen.getByLabelText(INPUT_LABEL), 'Again');
    await user.click(screen.getByRole('button', { name: SEND_BUTTON_NAME }));

    await waitFor(() =>
      expect(streamAssistantMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          contextType: undefined,
          contextId: undefined,
          conversationId: 42,
        }),
      ),
    );
  });

  test('auto-sends the initialMessage once when the drawer opens', async () => {
    streamAssistantMessage.mockImplementation(async function* mockStream() {
      yield { delta: 'auto reply', done: false };
      yield { delta: '', done: true, conversationId: 9 };
    });
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <AiAssistantDrawer
          isOpen
          onClose={vi.fn()}
          initialMessage="Tell me about this listing."
        />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('auto reply')).toBeInTheDocument();
    expect(screen.getByText('Tell me about this listing.')).toBeInTheDocument();
    expect(streamAssistantMessage).toHaveBeenCalledTimes(1);
  });
});
