import { useState } from 'react';
import PropTypes from 'prop-types';
import { describe, test, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Select from './Select.jsx';

const ROOM_OPTIONS = [
  { value: 'standard', label: 'Standard room' },
  { value: 'deluxe', label: 'Deluxe room' },
  { value: 'suite', label: 'Suite' },
];

function ControlledSelect({ initialValue, options, ...rest }) {
  const [value, setValue] = useState(initialValue);
  return (
    // eslint-disable-next-line react/jsx-props-no-spreading -- test helper forwards arbitrary Select props
    <Select {...rest} options={options} value={value} onChange={setValue} />
  );
}

ControlledSelect.propTypes = {
  // eslint-disable-next-line react/forbid-prop-types -- test helper accepts arbitrary initial values
  initialValue: PropTypes.any,
  // eslint-disable-next-line react/forbid-prop-types -- test helper forwards options through to Select
  options: PropTypes.array.isRequired,
};

ControlledSelect.defaultProps = {
  initialValue: undefined,
};

describe('Select / Dropdown (COMPONENT_LIBRARY.md Part II §2)', () => {
  test('is closed by default and opens on trigger click, showing options via role="listbox"', async () => {
    const user = userEvent.setup();
    render(<ControlledSelect options={ROOM_OPTIONS} label="Room type" />);

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /select/i }));

    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getAllByRole('option')).toHaveLength(3);
  });

  test('selecting an option via click calls onChange and closes the panel', async () => {
    const user = userEvent.setup();
    render(<ControlledSelect options={ROOM_OPTIONS} label="Room type" />);

    await user.click(screen.getByRole('button', { name: /select/i }));
    await user.click(screen.getByRole('option', { name: 'Deluxe room' }));

    expect(
      screen.getByRole('button', { name: 'Deluxe room' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  test('full keyboard flow: ArrowDown opens, ArrowDown navigates, Enter selects, Escape closes', async () => {
    const user = userEvent.setup();
    render(<ControlledSelect options={ROOM_OPTIONS} label="Room type" />);

    await user.tab();
    expect(screen.getByRole('button', { name: /select/i })).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.keyboard('{ArrowDown}{Enter}');
    expect(
      screen.getByRole('button', { name: 'Standard room' }),
    ).toBeInTheDocument();

    await user.keyboard('{ArrowDown}{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveFocus();
  });

  test('multi-select renders removable chips and toggles values without closing the panel', async () => {
    const user = userEvent.setup();
    render(
      <ControlledSelect
        options={ROOM_OPTIONS}
        label="Amenities"
        multiple
        initialValue={[]}
      />,
    );

    await user.click(screen.getByRole('button', { name: /select/i }));
    await user.click(screen.getByRole('option', { name: 'Standard room' }));
    await user.click(screen.getByRole('option', { name: 'Suite' }));

    const trigger = screen.getByTestId('select-trigger');

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(within(trigger).getByText('Standard room')).toBeInTheDocument();
    expect(within(trigger).getByText('Suite')).toBeInTheDocument();

    await user.click(
      within(trigger).getByRole('button', { name: 'Remove Standard room' }),
    );
    expect(
      within(trigger).queryByText('Standard room'),
    ).not.toBeInTheDocument();
  });

  test('searchable mode filters the option list as the user types', async () => {
    const user = userEvent.setup();
    render(
      <ControlledSelect options={ROOM_OPTIONS} label="Room type" searchable />,
    );

    await user.click(screen.getByRole('button', { name: /select/i }));
    await user.type(screen.getByRole('textbox', { name: /search/i }), 'suite');

    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getAllByRole('option')).toHaveLength(1);
    expect(
      within(listbox).getByRole('option', { name: 'Suite' }),
    ).toBeInTheDocument();
  });

  test('auto-enables search once options exceed the 8-option threshold', async () => {
    const manyOptions = Array.from({ length: 9 }, (_, index) => ({
      value: `opt-${index}`,
      label: `Option ${index}`,
    }));
    const user = userEvent.setup();
    render(<ControlledSelect options={manyOptions} label="Country" />);

    await user.click(screen.getByRole('button', { name: /select/i }));
    expect(
      screen.getByRole('textbox', { name: /search/i }),
    ).toBeInTheDocument();
  });

  test('renders an accessible error message linked to the trigger', async () => {
    render(
      <ControlledSelect
        options={ROOM_OPTIONS}
        label="Room type"
        error="Please choose a room"
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Please choose a room');
    expect(screen.getByRole('button').getAttribute('aria-describedby')).toBe(
      alert.id,
    );
  });

  test('disabled select cannot be opened', async () => {
    const user = userEvent.setup();
    render(
      <ControlledSelect options={ROOM_OPTIONS} label="Room type" disabled />,
    );

    await user.click(screen.getByRole('button', { name: /select/i }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
