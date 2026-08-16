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
});
