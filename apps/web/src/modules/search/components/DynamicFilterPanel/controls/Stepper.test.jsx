import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Stepper from './Stepper.jsx';

const ANY_LABEL = 'Any';
const DECREASE_LABEL = 'Decrease Bedrooms';
const INCREASE_LABEL = 'Increase Bedrooms';

describe('Stepper (apps/web/src/modules/search/components/DynamicFilterPanel/controls)', () => {
  test('shows "Any" and a disabled decrement button when no value is set', () => {
    const onChange = vi.fn();
    render(
      <Stepper
        label="Bedrooms"
        min={0}
        max={20}
        onChange={onChange}
        anyLabel={ANY_LABEL}
        decreaseAriaLabel={DECREASE_LABEL}
        increaseAriaLabel={INCREASE_LABEL}
      />,
    );
    expect(screen.getByText('Any')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Decrease Bedrooms' }),
    ).toBeDisabled();
  });

  test('incrementing from unset starts at min + 1', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Stepper
        label="Bedrooms"
        min={0}
        max={20}
        onChange={onChange}
        anyLabel={ANY_LABEL}
        decreaseAriaLabel={DECREASE_LABEL}
        increaseAriaLabel={INCREASE_LABEL}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Increase Bedrooms' }));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  test('decrementing down to min clears the value (calls onChange with undefined)', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Stepper
        label="Bedrooms"
        min={0}
        max={20}
        value={1}
        onChange={onChange}
        anyLabel={ANY_LABEL}
        decreaseAriaLabel={DECREASE_LABEL}
        increaseAriaLabel={INCREASE_LABEL}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Decrease Bedrooms' }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  test('increment is clamped at max and disables the increment button', () => {
    const onChange = vi.fn();
    render(
      <Stepper
        label="Bedrooms"
        min={0}
        max={5}
        value={5}
        onChange={onChange}
        anyLabel={ANY_LABEL}
        decreaseAriaLabel={DECREASE_LABEL}
        increaseAriaLabel={INCREASE_LABEL}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Increase Bedrooms' }),
    ).toBeDisabled();
  });

  test('displays the unit alongside the value', () => {
    render(
      <Stepper
        label="Bedrooms"
        unit="rooms"
        min={0}
        max={20}
        value={3}
        onChange={vi.fn()}
        anyLabel={ANY_LABEL}
        decreaseAriaLabel={DECREASE_LABEL}
        increaseAriaLabel={INCREASE_LABEL}
      />,
    );
    expect(screen.getByText('3+ rooms')).toBeInTheDocument();
  });
});
