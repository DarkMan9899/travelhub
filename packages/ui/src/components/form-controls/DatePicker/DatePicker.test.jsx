import { useState } from 'react';
import PropTypes from 'prop-types';
import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DatePicker from './DatePicker.jsx';

function ControlledDatePicker({ initialValue = null, ...rest }) {
  const [value, setValue] = useState(initialValue);
  return (
    // eslint-disable-next-line react/jsx-props-no-spreading -- test helper forwards arbitrary DatePicker props
    <DatePicker {...rest} value={value} onChange={setValue} />
  );
}
ControlledDatePicker.propTypes = {
  // eslint-disable-next-line react/forbid-prop-types -- value's shape varies by mode under test
  initialValue: PropTypes.any,
};

describe('DatePicker (COMPONENT_LIBRARY.md Part II §2)', () => {
  test('opens a keyboard-navigable day grid on click', async () => {
    const user = userEvent.setup();
    render(<ControlledDatePicker label="Date of birth" />);

    await user.click(screen.getByLabelText('Date of birth'));

    expect(screen.getByRole('grid')).toBeInTheDocument();
  });

  test('single mode selects a day and closes the panel', async () => {
    const user = userEvent.setup();
    const fixedToday = new Date(2026, 5, 15);
    render(
      <ControlledDatePicker
        label="Travel date"
        mode="single"
        initialValue={fixedToday}
      />,
    );

    await user.click(screen.getByLabelText('Travel date'));
    await user.click(screen.getByRole('gridcell', { name: /^Jun 20,/ }));

    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Travel date')).toHaveTextContent('20');
  });

  test('disabled dates cannot be selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const today = new Date();
    const disabledDay = new Date(today.getFullYear(), today.getMonth(), 10);
    const dayLabel = new Intl.DateTimeFormat('en', {
      day: 'numeric',
      month: 'short',
    }).format(disabledDay);

    render(
      <DatePicker
        label="Blackout date"
        value={null}
        onChange={onChange}
        disabledDates={[disabledDay]}
      />,
    );

    await user.click(screen.getByLabelText('Blackout date'));
    const disabledCell = screen.getByRole('gridcell', {
      name: new RegExp(`^${dayLabel},`),
    });
    expect(disabledCell).toBeDisabled();

    await user.click(disabledCell);
    expect(onChange).not.toHaveBeenCalled();
  });

  test('range mode requires a start then an end day', async () => {
    const user = userEvent.setup();
    render(<ControlledDatePicker label="Stay dates" mode="range" />);

    await user.click(screen.getByLabelText('Stay dates'));
    await user.click(screen.getByRole('gridcell', { name: /10/ }));
    expect(screen.getByRole('grid')).toBeInTheDocument();

    await user.click(screen.getByRole('gridcell', { name: /15/ }));
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Stay dates')).toHaveTextContent('–');
  });

  test('accepts minDate/maxDate as ISO date strings without crashing (real callers, e.g. ListingReservationWidget, pass toISODate() strings, not Date instances)', async () => {
    const user = userEvent.setup();
    const todayISO = new Date().toISOString().slice(0, 10);
    render(<ControlledDatePicker label="Check-in" minDate={todayISO} />);

    await user.click(screen.getByLabelText('Check-in'));

    expect(screen.getByRole('grid')).toBeInTheDocument();
  });

  test('onChange emits plain YYYY-MM-DD strings, not Date instances (real callers — ListingReservationWidget, AvailabilityStep — send value.start/end straight through as dateFrom/dateTo in a JSON request body with no conversion of their own)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const anchor = new Date(2026, 5, 15);
    render(
      <DatePicker
        label="Travel date"
        mode="single"
        value={anchor}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByLabelText('Travel date'));
    await user.click(screen.getByRole('gridcell', { name: /^Jun 20,/ }));

    expect(onChange).toHaveBeenCalledWith('2026-06-20');
  });

  test('range mode onChange emits {start, end} as YYYY-MM-DD strings', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const anchor = new Date(2026, 5, 1);
    render(
      <DatePicker
        label="Stay dates"
        mode="range"
        value={{ start: anchor, end: null }}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByLabelText('Stay dates'));
    await user.click(screen.getByRole('gridcell', { name: /^Jun 10,/ }));
    expect(onChange).toHaveBeenLastCalledWith({
      start: '2026-06-01',
      end: '2026-06-10',
    });
  });
});
