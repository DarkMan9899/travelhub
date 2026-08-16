import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RangeSlider from './RangeSlider.jsx';

const MIN_LABEL = 'Minimum Duration';
const MAX_LABEL = 'Maximum Duration';

describe('RangeSlider (apps/web/src/modules/search/components/DynamicFilterPanel/controls)', () => {
  test('renders two range inputs bound to the same min/max', () => {
    render(
      <RangeSlider
        label="Duration"
        unit="minutes"
        min={15}
        max={720}
        valueMin={15}
        valueMax={720}
        onChange={vi.fn()}
        minAriaLabel={MIN_LABEL}
        maxAriaLabel={MAX_LABEL}
      />,
    );
    const sliders = screen.getAllByRole('slider');
    expect(sliders).toHaveLength(2);
    sliders.forEach((slider) => {
      expect(slider).toHaveAttribute('min', '15');
      expect(slider).toHaveAttribute('max', '720');
    });
  });

  test('displays the current min/max values with the unit', () => {
    render(
      <RangeSlider
        label="Duration"
        unit="minutes"
        min={15}
        max={720}
        valueMin={30}
        valueMax={180}
        onChange={vi.fn()}
        minAriaLabel={MIN_LABEL}
        maxAriaLabel={MAX_LABEL}
      />,
    );
    expect(screen.getByText(/30 minutes/)).toBeInTheDocument();
    expect(screen.getByText(/180 minutes/)).toBeInTheDocument();
  });

  test('moving the min thumb past the max thumb clamps it to valueMax', () => {
    const onChange = vi.fn();
    render(
      <RangeSlider
        label="Duration"
        min={0}
        max={100}
        valueMin={20}
        valueMax={50}
        onChange={onChange}
        minAriaLabel={MIN_LABEL}
        maxAriaLabel={MAX_LABEL}
      />,
    );
    const [minSlider] = screen.getAllByRole('slider');
    // fireEvent.change (not a raw dispatchEvent) so React's own change
    // handling picks it up, exercising this component's Math.min guard.
    fireEvent.change(minSlider, { target: { value: '80' } });
    expect(onChange).toHaveBeenCalledWith(50, 50);
  });

  test('moving the max thumb below the min thumb clamps it to valueMin', () => {
    const onChange = vi.fn();
    render(
      <RangeSlider
        label="Duration"
        min={0}
        max={100}
        valueMin={20}
        valueMax={50}
        onChange={onChange}
        minAriaLabel={MIN_LABEL}
        maxAriaLabel={MAX_LABEL}
      />,
    );
    const [, maxSlider] = screen.getAllByRole('slider');
    fireEvent.change(maxSlider, { target: { value: '10' } });
    expect(onChange).toHaveBeenCalledWith(20, 20);
  });
});
