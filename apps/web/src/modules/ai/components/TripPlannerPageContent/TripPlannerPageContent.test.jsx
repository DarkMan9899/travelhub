import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TripPlannerPageContent from './TripPlannerPageContent.jsx';
import { usePlanTripMutation } from '../../mutations/usePlanTripMutation.js';

vi.mock('../../mutations/usePlanTripMutation.js', () => ({
  usePlanTripMutation: vi.fn(),
}));

const PLAN_RESPONSE = {
  data: {
    conversation_id: 42,
    destination: 'Yerevan',
    days: 2,
    currency: 'AMD',
    narrative: 'A lovely trip awaits.',
    total_estimated_budget: 150,
    daily_plan: [{ day: 1, listings: [] }],
  },
};

describe('TripPlannerPageContent (apps/web/src/modules/ai)', () => {
  let mutate;

  beforeEach(() => {
    mutate = vi.fn((input, { onSuccess }) => onSuccess(PLAN_RESPONSE));
    usePlanTripMutation.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
      reset: vi.fn(),
    });
  });

  test('submitting the form renders the returned itinerary', async () => {
    const user = userEvent.setup();
    render(<TripPlannerPageContent />);

    await user.type(screen.getByLabelText(/^Նպատակակետ/), 'Yerevan');
    await user.click(
      screen.getByRole('button', { name: 'Պլանավորել իմ ուղևորությունը' }),
    );

    expect(mutate).toHaveBeenCalled();
    expect(screen.getByText('A lovely trip awaits.')).toBeInTheDocument();
  });

  test('a mutation error renders a retryable error state', () => {
    usePlanTripMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      error: { message: 'Boom' },
      reset: vi.fn(),
    });
    render(<TripPlannerPageContent />);
    expect(screen.getByText('Boom')).toBeInTheDocument();
  });
});
