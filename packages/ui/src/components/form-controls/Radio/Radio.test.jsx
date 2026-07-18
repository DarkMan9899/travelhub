import { useState } from 'react';
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Radio from './Radio.jsx';

function RadioGroup() {
  const [selected, setSelected] = useState('standard');

  return (
    <>
      <Radio
        name="room-type"
        value="standard"
        label="Standard room"
        checked={selected === 'standard'}
        onChange={() => setSelected('standard')}
      />
      <Radio
        name="room-type"
        value="deluxe"
        label="Deluxe room"
        checked={selected === 'deluxe'}
        onChange={() => setSelected('deluxe')}
      />
    </>
  );
}

describe('Radio (COMPONENT_LIBRARY.md Part II §2)', () => {
  test('only one radio in a shared-name group is checked at a time', async () => {
    const user = userEvent.setup();
    render(<RadioGroup />);

    const standard = screen.getByRole('radio', { name: 'Standard room' });
    const deluxe = screen.getByRole('radio', { name: 'Deluxe room' });

    expect(standard).toBeChecked();
    expect(deluxe).not.toBeChecked();

    await user.click(screen.getByText('Deluxe room'));

    expect(deluxe).toBeChecked();
    expect(standard).not.toBeChecked();
  });

  test('disabled radio cannot be selected', async () => {
    const onChange = () => {};
    const user = userEvent.setup();
    render(
      <Radio
        name="x"
        value="a"
        label="Unavailable"
        checked={false}
        onChange={onChange}
        disabled
      />,
    );

    const radio = screen.getByRole('radio', { name: 'Unavailable' });
    expect(radio).toBeDisabled();

    await user.click(radio);
    expect(radio).not.toBeChecked();
  });

  test('renders an associated error message', () => {
    render(
      <Radio
        name="x"
        value="a"
        label="Option"
        checked={false}
        onChange={() => {}}
        error="Pick one"
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Pick one');
  });
});
