import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SimulatedPaymentNotice from './SimulatedPaymentNotice.jsx';

describe('SimulatedPaymentNotice (apps/web/src/modules/payments)', () => {
  test('renders the title and description by default', () => {
    render(<SimulatedPaymentNotice />);
    expect(
      screen.getByText('Փորձնական/Ցուցադրական վճարում'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Իրական գումար չի գանձվում/)).toBeInTheDocument();
  });

  test('omits the title when compact', () => {
    render(<SimulatedPaymentNotice compact />);
    expect(
      screen.queryByText('Փորձնական/Ցուցադրական վճարում'),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Իրական գումար չի գանձվում/)).toBeInTheDocument();
  });
});
