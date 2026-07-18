import { useState } from 'react';
import PropTypes from 'prop-types';
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Switch from './Switch.jsx';

function ControlledSwitch({ initialChecked, ...rest }) {
  const [checked, setChecked] = useState(initialChecked);
  return (
    <Switch
      // eslint-disable-next-line react/jsx-props-no-spreading -- test helper forwards arbitrary Switch props
      {...rest}
      checked={checked}
      onChange={(e) => setChecked(e.target.checked)}
    />
  );
}

ControlledSwitch.propTypes = {
  initialChecked: PropTypes.bool,
};

ControlledSwitch.defaultProps = {
  initialChecked: false,
};

describe('Switch (COMPONENT_LIBRARY.md Part II §2)', () => {
  test('exposes the switch role', () => {
    render(<ControlledSwitch label="Email notifications" />);
    expect(
      screen.getByRole('switch', { name: 'Email notifications' }),
    ).toBeInTheDocument();
  });

  test('toggles on click and reflects aria-checked', async () => {
    const user = userEvent.setup();
    render(<ControlledSwitch label="SMS alerts" />);

    const toggle = screen.getByRole('switch', { name: 'SMS alerts' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  test('disabled switch cannot be toggled', async () => {
    const user = userEvent.setup();
    render(<ControlledSwitch label="Locked setting" disabled />);

    const toggle = screen.getByRole('switch', { name: 'Locked setting' });
    expect(toggle).toBeDisabled();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });
});
