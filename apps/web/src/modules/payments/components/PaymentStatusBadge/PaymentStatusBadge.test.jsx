import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PaymentStatusBadge from './PaymentStatusBadge.jsx';

describe('PaymentStatusBadge (apps/web/src/modules/payments)', () => {
  test('renders the Armenian translated label for SUCCEEDED', () => {
    render(<PaymentStatusBadge status="SUCCEEDED" />);
    expect(screen.getByText('Վճարված')).toBeInTheDocument();
  });

  test('renders the Armenian translated label for FAILED', () => {
    render(<PaymentStatusBadge status="FAILED" />);
    expect(screen.getByText('Մերժված')).toBeInTheDocument();
  });

  test('renders every known status code without throwing', () => {
    const statuses = [
      'CREATED',
      'REQUIRES_ACTION',
      'PROCESSING',
      'AUTHORIZED',
      'SUCCEEDED',
      'FAILED',
      'CANCELLED',
      'PARTIALLY_REFUNDED',
      'REFUNDED',
    ];
    statuses.forEach((status) => {
      const { unmount } = render(<PaymentStatusBadge status={status} />);
      unmount();
    });
  });

  test('falls back to the raw code for an unrecognized status', () => {
    render(<PaymentStatusBadge status="SOMETHING_NEW" />);
    expect(screen.getByText('SOMETHING_NEW')).toBeInTheDocument();
  });
});
