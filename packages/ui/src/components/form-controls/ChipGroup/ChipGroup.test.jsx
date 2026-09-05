import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChipGroup from './ChipGroup.jsx';

const OPTIONS = [
  { value: '16', label: 'Easy' },
  { value: '17', label: 'Moderate' },
];

describe('ChipGroup (packages/ui/src/components/form-controls)', () => {
  test('renders every option as a chip, none pressed when nothing is selected', () => {
    render(
      <ChipGroup label="Difficulty" options={OPTIONS} onChange={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Easy' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  test('clicking an unselected chip selects it', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ChipGroup label="Difficulty" options={OPTIONS} onChange={onChange} />,
    );
    await user.click(screen.getByRole('button', { name: 'Easy' }));
    expect(onChange).toHaveBeenCalledWith('16');
  });

  test('clicking the already-selected chip deselects it', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ChipGroup
        label="Difficulty"
        options={OPTIONS}
        selectedValue="16"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('button', { name: 'Easy' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Easy' }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  test('a disabled option renders as a disabled button and never fires onChange', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ChipGroup
        label="Difficulty"
        options={[
          ...OPTIONS,
          { value: '18', label: 'Sold out', disabled: true },
        ]}
        onChange={onChange}
      />,
    );
    const soldOutChip = screen.getByRole('button', { name: 'Sold out' });
    expect(soldOutChip).toBeDisabled();
    await user.click(soldOutChip);
    expect(onChange).not.toHaveBeenCalled();
  });
});
