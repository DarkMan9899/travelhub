import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BookingStatusBadge from './BookingStatusBadge.jsx';

describe('BookingStatusBadge (apps/web/src/modules/bookings)', () => {
  test('renders the Armenian translated label for PENDING_VENDOR', () => {
    render(<BookingStatusBadge status="PENDING_VENDOR" />);
    expect(screen.getByText('Սպասվում է հաստատման')).toBeInTheDocument();
  });

  test('renders the Armenian translated label for CONFIRMED', () => {
    render(<BookingStatusBadge status="CONFIRMED" />);
    expect(screen.getByText('Հաստատված')).toBeInTheDocument();
  });

  test('renders every known status code without throwing', () => {
    const statuses = [
      'DRAFT',
      'PENDING_VENDOR',
      'CONFIRMED',
      'REJECTED',
      'CANCELLED_BY_CUSTOMER',
      'CANCELLED_BY_VENDOR',
      'COMPLETED',
      'NO_SHOW',
      'EXPIRED',
    ];
    statuses.forEach((status) => {
      const { unmount } = render(<BookingStatusBadge status={status} />);
      unmount();
    });
  });

  test('falls back to the raw code for an unrecognized status', () => {
    render(<BookingStatusBadge status="SOMETHING_NEW" />);
    expect(screen.getByText('SOMETHING_NEW')).toBeInTheDocument();
  });

  test('uses the customer-directional label by default for CANCELLED_BY_CUSTOMER', () => {
    render(<BookingStatusBadge status="CANCELLED_BY_CUSTOMER" />);
    expect(screen.getByText('Չեղարկված ձեր կողմից')).toBeInTheDocument();
  });

  test('uses the partner-directional override for CANCELLED_BY_CUSTOMER when audience="partner"', () => {
    render(
      <BookingStatusBadge status="CANCELLED_BY_CUSTOMER" audience="partner" />,
    );
    expect(
      screen.getByText('Չեղարկվել է հաճախորդի կողմից'),
    ).toBeInTheDocument();
  });

  test('CANCELLED_BY_VENDOR is unaffected by audience (no override needed)', () => {
    render(
      <BookingStatusBadge status="CANCELLED_BY_VENDOR" audience="partner" />,
    );
    expect(
      screen.getByText('Չեղարկված հյուրընկալողի կողմից'),
    ).toBeInTheDocument();
  });
});
