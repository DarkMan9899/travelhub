import { useState } from 'react';
import PropTypes from 'prop-types';
import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import MetadataFieldRenderer from './MetadataFieldRenderer.jsx';

// `MetadataFieldRenderer` reads the URL's `:locale` segment (to pass a
// locale-aware `DatePicker`), so every render needs a Router context.
function renderWithRouter(ui) {
  return render(
    <MemoryRouter initialEntries={['/hy/partner/listings/new']}>
      <Routes>
        <Route path="/:locale/partner/listings/new" element={ui} />
      </Routes>
    </MemoryRouter>,
  );
}

// Runs under the test harness's default Armenian locale (tests/setup.js).
// The `sample_*` codes below are deliberately not real backend attribute/
// policy codes — this file tests per-`data_type` control rendering, not
// translation coverage (that's `apps/web/src/translations/*/common.json`'s
// own job, verified separately), so using codes with no translation entry
// keeps these assertions stable regardless of which real codes later gain
// real copy. `cancellation_policy`'s options and the increase/decrease
// control strings ARE real, translated content — asserted against
// directly, not their fallback.

function ControlledField({ initialValue = undefined, ...rest }) {
  const [value, setValue] = useState(initialValue);
  return (
    // eslint-disable-next-line react/jsx-props-no-spreading -- test helper forwards arbitrary MetadataFieldRenderer props
    <MetadataFieldRenderer {...rest} value={value} onChange={setValue} />
  );
}

ControlledField.propTypes = {
  // eslint-disable-next-line react/forbid-prop-types -- value's shape varies by data_type under test
  initialValue: PropTypes.any,
};

describe('MetadataFieldRenderer (PartnerListingWizard)', () => {
  test('BOOLEAN renders a Switch', async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <ControlledField
        namespace="policies"
        definition={{ code: 'sample_boolean', data_type: 'BOOLEAN' }}
        initialValue={false}
      />,
    );
    const toggle = screen.getByRole('switch', { name: 'sample_boolean' });
    expect(toggle).not.toBeChecked();
    await user.click(toggle);
    expect(toggle).toBeChecked();
  });

  test('INTEGER renders a NumberStepperField honoring min/max/unit', async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <ControlledField
        namespace="attributes"
        definition={{
          code: 'sample_integer',
          data_type: 'INTEGER',
          unit: 'sample_unit',
          min: 0,
          max: 3,
        }}
        initialValue={3}
      />,
    );
    expect(screen.getByText('sample_unit')).toBeInTheDocument();
    const increment = screen.getByRole('button', {
      name: 'Ավելացնել sample_integer',
    });
    expect(increment).toBeDisabled();
    await user.click(
      screen.getByRole('button', { name: 'Նվազեցնել sample_integer' }),
    );
    expect(screen.getByLabelText('sample_integer')).toHaveValue(2);
  });

  test('DATE renders a DatePicker', async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <ControlledField
        namespace="attributes"
        definition={{ code: 'sample_date', data_type: 'DATE' }}
      />,
    );
    await user.click(screen.getByLabelText('sample_date'));
    expect(screen.getByRole('grid')).toBeInTheDocument();
  });

  test('ENUM renders a single-select with resolved option labels', async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <ControlledField
        namespace="policies"
        definition={{
          code: 'cancellation_policy',
          data_type: 'ENUM',
          options: [
            { value: 1, code: 'FLEXIBLE' },
            { value: 2, code: 'STRICT' },
          ],
        }}
      />,
    );
    await user.click(screen.getByTestId('select-trigger'));
    await user.click(screen.getByRole('option', { name: 'Խիստ' }));
    expect(screen.getByTestId('select-trigger')).toHaveTextContent('Խիստ');
  });

  test('MULTI_ENUM renders a multi-select whose value is an array of option codes', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithRouter(
      <MetadataFieldRenderer
        namespace="attributes"
        definition={{
          code: 'sample_multi_enum',
          data_type: 'MULTI_ENUM',
          options: [
            { value: 1, code: 'SAMPLE_OPTION_A' },
            { value: 2, code: 'SAMPLE_OPTION_B' },
          ],
        }}
        value={[]}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByTestId('select-trigger'));
    await user.click(screen.getByRole('option', { name: 'SAMPLE_OPTION_B' }));
    expect(onChange).toHaveBeenCalledWith(['SAMPLE_OPTION_B']);
  });

  test('STRING falls back to a text Input', async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <ControlledField
        namespace="policies"
        definition={{ code: 'sample_string', data_type: 'STRING' }}
        initialValue=""
      />,
    );
    const input = screen.getByLabelText('sample_string');
    await user.type(input, '14:00');
    expect(input).toHaveValue('14:00');
  });

  test('forwards a required marker and an error message to the underlying control', () => {
    renderWithRouter(
      <ControlledField
        namespace="attributes"
        definition={{
          code: 'sample_string_required',
          data_type: 'STRING',
          is_required: true,
        }}
        error="This field is required"
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This field is required',
    );
  });
});
