import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BookableUnitForm from './BookableUnitForm.jsx';

describe('BookableUnitForm (P2.2A)', () => {
  test('shows the unit-type selector only when showTypeSelector is true', () => {
    const { rerender } = render(
      <BookableUnitForm
        showTypeSelector
        submitLabel="Register"
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByText('Միավորի տեսակ')).toBeInTheDocument();

    rerender(
      <BookableUnitForm
        showTypeSelector={false}
        submitLabel="Save"
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.queryByText('Միավորի տեսակ')).not.toBeInTheDocument();
  });

  test('submits capacity/maxGuests/unitLabel and the default unit type, with no bed configuration or price when none was entered', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <BookableUnitForm
        showTypeSelector
        submitLabel="Գրանցել միավոր"
        onSubmit={onSubmit}
      />,
    );

    await user.type(
      screen.getByLabelText('Սենյակի/միավորի անվանում'),
      'Deluxe Suite',
    );
    await user.type(screen.getByLabelText('Գույքագրման քանակ'), '4');
    await user.type(
      screen.getByLabelText('Առավելագույն հյուրեր մեկ սենյակում'),
      '2',
    );
    await user.click(screen.getByRole('button', { name: 'Գրանցել միավոր' }));

    expect(onSubmit).toHaveBeenCalledWith({
      bookableUnitType: 'HOTEL_ROOM',
      unitLabel: 'Deluxe Suite',
      capacity: 4,
      maxGuests: 2,
      bedConfiguration: undefined,
      basePriceAmount: undefined,
      basePriceCurrency: undefined,
    });
  });

  test('adding a bed row includes it (with the default type/count) in the submitted payload', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<BookableUnitForm submitLabel="Save" onSubmit={onSubmit} />);

    await user.click(
      screen.getByRole('button', { name: 'Ավելացնել մահճակալ' }),
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        bedConfiguration: [{ type: 'SINGLE', count: 1 }],
      }),
    );
  });

  test('removing a bed row leaves bedConfiguration undefined again', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<BookableUnitForm submitLabel="Save" onSubmit={onSubmit} />);

    await user.click(
      screen.getByRole('button', { name: 'Ավելացնել մահճակալ' }),
    );
    await user.click(screen.getByRole('button', { name: 'Հեռացնել' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ bedConfiguration: undefined }),
    );
  });

  test('entering a base price amount without a currency shows an incomplete warning and disables submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<BookableUnitForm submitLabel="Save" onSubmit={onSubmit} />);

    await user.type(
      screen.getByLabelText('Հիմնական գին մեկ գիշերվա համար'),
      '100',
    );

    expect(
      screen.getByText(
        'Նշեք և՛ գումարը, և՛ արժույթը, կամ թողեք երկուսն էլ դատարկ։',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('start/end time fields only show when creating (showTypeSelector), never in edit mode', () => {
    const { rerender } = render(
      <BookableUnitForm
        showTypeSelector
        submitLabel="Register"
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Մեկնման սկզբի ժամը')).toBeInTheDocument();
    expect(screen.getByLabelText('Մեկնման ավարտի ժամը')).toBeInTheDocument();

    rerender(
      <BookableUnitForm
        showTypeSelector={false}
        submitLabel="Save"
        onSubmit={vi.fn()}
      />,
    );
    expect(
      screen.queryByLabelText('Մեկնման սկզբի ժամը'),
    ).not.toBeInTheDocument();
  });

  test('a time-sliced unit (both start and end filled in) submits real timeSlotStart/timeSlotEnd', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <BookableUnitForm
        showTypeSelector
        submitLabel="Գրանցել միավոր"
        onSubmit={onSubmit}
      />,
    );

    await user.type(
      screen.getByLabelText('Սենյակի/միավորի անվանում'),
      'Morning Departure',
    );
    await user.type(screen.getByLabelText('Գույքագրման քանակ'), '12');
    await user.type(screen.getByLabelText('Մեկնման սկզբի ժամը'), '09:00');
    await user.type(screen.getByLabelText('Մեկնման ավարտի ժամը'), '13:00');
    await user.click(screen.getByRole('button', { name: 'Գրանցել միավոր' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        timeSlotStart: '09:00',
        timeSlotEnd: '13:00',
      }),
    );
  });

  test('leaving both start and end time blank keeps the unit date-only — never sends a fake time', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <BookableUnitForm
        showTypeSelector
        submitLabel="Գրանցել միավոր"
        onSubmit={onSubmit}
      />,
    );

    await user.type(
      screen.getByLabelText('Սենյակի/միավորի անվանում'),
      'Standard Room',
    );
    await user.click(screen.getByRole('button', { name: 'Գրանցել միավոր' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        timeSlotStart: undefined,
        timeSlotEnd: undefined,
      }),
    );
  });

  test('filling only one of start/end shows an incomplete warning and disables submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <BookableUnitForm
        showTypeSelector
        submitLabel="Գրանցել միավոր"
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText('Մեկնման սկզբի ժամը'), '09:00');

    expect(
      screen.getByText(
        'Նշեք և՛ սկզբի, և՛ ավարտի ժամը, կամ թողեք երկուսն էլ դատարկ։',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Գրանցել միավոր' }),
    ).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('an end time at or before the start time is rejected with a real error, submit disabled', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <BookableUnitForm
        showTypeSelector
        submitLabel="Գրանցել միավոր"
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText('Մեկնման սկզբի ժամը'), '14:00');
    await user.type(screen.getByLabelText('Մեկնման ավարտի ժամը'), '09:00');

    expect(
      screen.getByText('Ավարտի ժամը պետք է լինի սկզբի ժամից ուշ։'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Գրանցել միավոր' }),
    ).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('edit mode pre-fills from initialValues and Cancel calls onCancel', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <BookableUnitForm
        initialValues={{
          unitLabel: 'Standard Room',
          capacity: 5,
          maxGuests: 2,
        }}
        submitLabel="Save"
        onSubmit={vi.fn()}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByLabelText('Սենյակի/միավորի անվանում')).toHaveValue(
      'Standard Room',
    );
    expect(screen.getByLabelText('Գույքագրման քանակ')).toHaveValue(5);
    expect(
      screen.getByLabelText('Առավելագույն հյուրեր մեկ սենյակում'),
    ).toHaveValue(2);

    await user.click(screen.getByRole('button', { name: 'Չեղարկել' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
