import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AiAssistantTrigger from './AiAssistantTrigger.jsx';
import { useAuth } from '../../../../contexts/AuthContext.jsx';

vi.mock('../../../../contexts/AuthContext.jsx', () => ({ useAuth: vi.fn() }));
vi.mock('../AiAssistantDrawer/AiAssistantDrawer.jsx', () => ({
  default: ({ isOpen }) =>
    isOpen ? <div data-testid="assistant-drawer" /> : null,
}));

describe('AiAssistantTrigger (apps/web/src/modules/ai)', () => {
  test('renders nothing for a logged-out visitor', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, isBootstrapping: false });
    render(<AiAssistantTrigger />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('renders nothing while bootstrapping', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, isBootstrapping: true });
    render(<AiAssistantTrigger />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('opens the drawer on click', async () => {
    useAuth.mockReturnValue({ isAuthenticated: true, isBootstrapping: false });
    const user = userEvent.setup();
    render(<AiAssistantTrigger />);

    expect(screen.queryByTestId('assistant-drawer')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button'));
    expect(screen.getByTestId('assistant-drawer')).toBeInTheDocument();
  });
});
