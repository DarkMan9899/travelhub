import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MessageComposer from './MessageComposer.jsx';
import {
  sendMessage,
  uploadMessageAttachment,
  setTyping,
} from '../../../../api/messaging.js';

vi.mock('../../../../api/messaging.js', () => ({
  sendMessage: vi.fn(),
  uploadMessageAttachment: vi.fn(),
  setTyping: vi.fn(),
}));

function renderComposer() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MessageComposer conversationId={1} />
    </QueryClientProvider>,
  );
}

describe('MessageComposer (apps/web/src/modules/messaging)', () => {
  beforeEach(() => {
    sendMessage.mockReset();
    uploadMessageAttachment.mockReset();
    setTyping.mockReset();
  });

  test('send button is disabled with an empty body and no attachments', () => {
    renderComposer();
    expect(screen.getByRole('button', { name: 'Ուղարկել' })).toBeDisabled();
  });

  test('typing enables the send button and submitting calls sendMessage', async () => {
    sendMessage.mockResolvedValue({ data: { id: 1, body: 'hi' } });
    renderComposer();
    const user = userEvent.setup();

    const textbox = screen.getByPlaceholderText('Գրեք հաղորդագրություն…');
    await user.type(textbox, 'hi');
    const sendButton = screen.getByRole('button', { name: 'Ուղարկել' });
    expect(sendButton).not.toBeDisabled();

    await user.click(sendButton);
    expect(sendMessage).toHaveBeenCalledWith(1, {
      body: 'hi',
      attachmentMediaIds: [],
    });
  });

  test('clears the textarea after a successful send', async () => {
    sendMessage.mockResolvedValue({ data: { id: 1, body: 'hi' } });
    renderComposer();
    const user = userEvent.setup();

    const textbox = screen.getByPlaceholderText('Գրեք հաղորդագրություն…');
    await user.type(textbox, 'hi');
    await user.click(screen.getByRole('button', { name: 'Ուղարկել' }));

    expect(
      await screen.findByPlaceholderText('Գրեք հաղորդագրություն…'),
    ).toHaveValue('');
  });
});
