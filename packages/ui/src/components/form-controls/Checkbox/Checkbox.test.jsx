import { useState } from 'react';
import PropTypes from 'prop-types';
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Checkbox from './Checkbox.jsx';

function ControlledCheckbox({ initialChecked, ...rest }) {
  const [checked, setChecked] = useState(initialChecked);
  return (
    <Checkbox
      // eslint-disable-next-line react/jsx-props-no-spreading -- test helper forwards arbitrary Checkbox props
      {...rest}
      checked={checked}
      onChange={(e) => setChecked(e.target.checked)}
    />
  );
}

ControlledCheckbox.propTypes = {
  initialChecked: PropTypes.bool,
};

ControlledCheckbox.defaultProps = {
  initialChecked: false,
};

describe('Checkbox (COMPONENT_LIBRARY.md Part II §2)', () => {
  test('renders the native checkbox role, unchecked by default', () => {
    render(<ControlledCheckbox label="Accept terms" />);
    expect(
      screen.getByRole('checkbox', { name: 'Accept terms' }),
    ).not.toBeChecked();
  });

  test('clicking the label toggles the control', async () => {
    const user = userEvent.setup();
    render(<ControlledCheckbox label="Subscribe to newsletter" />);

    const checkbox = screen.getByRole('checkbox', {
      name: 'Subscribe to newsletter',
    });
    await user.click(screen.getByText('Subscribe to newsletter'));

    expect(checkbox).toBeChecked();
  });

  test('supports the indeterminate visual state', () => {
    render(<ControlledCheckbox label="Select all" indeterminate />);
    expect(
      screen.getByRole('checkbox', { name: 'Select all' }).indeterminate,
    ).toBe(true);
  });

  test('disabled checkbox cannot be toggled', async () => {
    const user = userEvent.setup();
    render(<ControlledCheckbox label="Locked" disabled />);

    const checkbox = screen.getByRole('checkbox', { name: 'Locked' });
    expect(checkbox).toBeDisabled();

    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  test('renders an associated error message', () => {
    render(
      <ControlledCheckbox
        label="Accept terms"
        error="You must accept the terms"
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'You must accept the terms',
    );
  });
});
