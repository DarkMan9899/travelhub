import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CheckboxGroup from './CheckboxGroup.jsx';

const OPTIONS = [
  { value: '1', label: 'WiFi' },
  { value: '2', label: 'Parking' },
];

describe('CheckboxGroup (apps/web/src/modules/search/components/DynamicFilterPanel/controls)', () => {
  test('renders one checkbox per option, checked to match selectedValues', () => {
    render(
      <CheckboxGroup
        label="Amenities"
        options={OPTIONS}
        selectedValues={['1']}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('checkbox', { name: 'WiFi' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Parking' })).not.toBeChecked();
  });

  test('checking an unchecked option adds it to the selection', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <CheckboxGroup
        label="Amenities"
        options={OPTIONS}
        selectedValues={['1']}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole('checkbox', { name: 'Parking' }));
    expect(onChange).toHaveBeenCalledWith(['1', '2']);
  });

  test('unchecking a checked option removes it from the selection', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <CheckboxGroup
        label="Amenities"
        options={OPTIONS}
        selectedValues={['1', '2']}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole('checkbox', { name: 'WiFi' }));
    expect(onChange).toHaveBeenCalledWith(['2']);
  });
});
