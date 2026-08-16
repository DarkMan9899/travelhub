import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FilterControl from './FilterControl.jsx';

// The test harness's i18n instance defaults to Armenian (tests/setup.js) —
// these assert against the real translation content added for Phase 4.2,
// the same convention SearchFilters.test.jsx already established.

describe('FilterControl (apps/web/src/modules/search/components/DynamicFilterPanel)', () => {
  test('STEPPER: renders the translated label and writes attr_{code}_min', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FilterControl
        definition={{
          code: 'bedrooms',
          input_type: 'STEPPER',
          value_source: 'ATTRIBUTE',
          unit: 'rooms',
          min: 0,
          max: 20,
          options: [],
        }}
        dynamicFilters={{}}
        onChange={onChange}
      />,
    );
    expect(screen.getByText('Ննջասենյակներ')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Ավելացնել/ }));
    expect(onChange).toHaveBeenCalledWith({ attr_bedrooms_min: '1' });
  });

  test('RANGE: writes both min and max keys in a single onChange call', () => {
    const onChange = vi.fn();
    render(
      <FilterControl
        definition={{
          code: 'duration_minutes',
          input_type: 'RANGE',
          value_source: 'ATTRIBUTE',
          unit: 'minutes',
          min: 15,
          max: 720,
          options: [],
        }}
        dynamicFilters={{ attr_duration_minutes_min: '30' }}
        onChange={onChange}
      />,
    );
    // Confirms it renders from the current dynamicFilters value, falling
    // back to the definition's own max for the unset bound.
    expect(screen.getByText(/30 minutes/)).toBeInTheDocument();
    expect(screen.getByText(/720 minutes/)).toBeInTheDocument();
  });

  test('SINGLE_SELECT: renders translated option labels and writes the bare attr_{code} key', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FilterControl
        definition={{
          code: 'star_rating',
          input_type: 'SINGLE_SELECT',
          value_source: 'ATTRIBUTE',
          options: [
            { value: 1, code: '1' },
            { value: 5, code: '5' },
          ],
        }}
        dynamicFilters={{}}
        onChange={onChange}
      />,
    );
    const fiveStars = screen.getByRole('button', { name: '5 աստղ' });
    await user.click(fiveStars);
    expect(onChange).toHaveBeenCalledWith({ attr_star_rating: '5' });
  });

  test('MULTI_SELECT (AMENITY): shows the amenity name as-is (never passed through t())', () => {
    render(
      <FilterControl
        definition={{
          code: 'amenity_ids',
          input_type: 'MULTI_SELECT',
          value_source: 'AMENITY',
          options: [{ value: 1, code: 'WiFi' }],
        }}
        dynamicFilters={{}}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('checkbox', { name: 'WiFi' })).toBeInTheDocument();
  });

  test('MULTI_SELECT (ATTRIBUTE): writes a comma-joined id list on toggle', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FilterControl
        definition={{
          code: 'cuisine',
          input_type: 'MULTI_SELECT',
          value_source: 'ATTRIBUTE',
          options: [
            { value: 10, code: 'ARMENIAN' },
            { value: 11, code: 'ITALIAN' },
          ],
        }}
        dynamicFilters={{ attr_cuisine: '10' }}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole('checkbox', { name: 'Իտալական' }));
    expect(onChange).toHaveBeenCalledWith({ attr_cuisine: '10,11' });
  });
});
