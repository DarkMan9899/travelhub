import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import BasicInfoStep from './BasicInfoStep.jsx';
import { useCreateListingMutation } from '../../../mutations/useCreateListingMutation.js';
import { useUpdateListingMutation } from '../../../mutations/useUpdateListingMutation.js';

vi.mock('../../../mutations/useCreateListingMutation.js', () => ({
  useCreateListingMutation: vi.fn(),
}));
vi.mock('../../../mutations/useUpdateListingMutation.js', () => ({
  useUpdateListingMutation: vi.fn(),
}));

const PARTNERSHIPS = [
  {
    partner_id: 1,
    slug: 'yerevan-boutique-hospitality',
    display_name: 'Yerevan Boutique Hospitality',
  },
];

function renderStep(props) {
  return render(
    <MemoryRouter initialEntries={['/en/partner/listings/new']}>
      <Routes>
        <Route
          path="/:locale/partner/listings/new"
          element={
            <BasicInfoStep
              partnerships={PARTNERSHIPS}
              onCreated={vi.fn()}
              onNext={vi.fn()}
              // eslint-disable-next-line react/jsx-props-no-spreading -- test harness forwards per-test overrides
              {...props}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('BasicInfoStep (PartnerListingWizard)', () => {
  let createMutateAsync;
  let updateMutateAsync;

  beforeEach(() => {
    createMutateAsync = vi.fn().mockResolvedValue({ data: { id: 42 } });
    updateMutateAsync = vi.fn().mockResolvedValue({ data: { id: 7 } });
    useCreateListingMutation.mockReturnValue({
      mutateAsync: createMutateAsync,
      isPending: false,
      error: null,
    });
    useUpdateListingMutation.mockReturnValue({
      mutateAsync: updateMutateAsync,
      isPending: false,
      error: null,
    });
  });

  test('shows listingType and (multi-partner) partner selects when no listing exists yet', () => {
    renderStep({
      partnerships: [
        ...PARTNERSHIPS,
        {
          partner_id: 2,
          slug: 'second-partner',
          display_name: 'Second Partner',
        },
      ],
    });
    expect(screen.getByText('Գործընկեր կազմակերպություն')).toBeInTheDocument();
    expect(screen.getByText('Հայտարարության տեսակ')).toBeInTheDocument();
  });

  test('hides the partner select when the partner has exactly one partnership', () => {
    renderStep({});
    expect(
      screen.queryByText('Գործընկեր կազմակերպություն'),
    ).not.toBeInTheDocument();
  });

  test('submitting with no listing yet calls createListing with translations + categoryIds, then onCreated + onNext', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    const onNext = vi.fn();
    renderStep({ categoryId: 3, onCreated, onNext });

    await user.click(screen.getByTestId('select-trigger'));
    await user.click(screen.getByRole('option', { name: 'Հյուրանոց' }));
    await user.type(
      screen.getByLabelText(/Վերնագիր/),
      'Boutique Yerevan Hotel',
    );
    await user.click(screen.getByRole('button', { name: 'Շարունակել' }));

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalled());
    expect(createMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        partnerId: 1,
        listingType: 'HOTEL',
        categoryIds: [3],
        translations: [
          expect.objectContaining({ title: 'Boutique Yerevan Hotel' }),
        ],
      }),
    );
    expect(onCreated).toHaveBeenCalledWith(42);
    expect(onNext).not.toHaveBeenCalled();
  });

  test('once a listing exists, only translations are editable and updateListing is called', async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    renderStep({
      listingId: 7,
      initialValues: { title: 'Existing title' },
      onNext,
    });

    expect(screen.queryByText('Հայտարարության տեսակ')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Շարունակել' }));

    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalled());
    expect(updateMutateAsync).toHaveBeenCalledWith({
      id: 7,
      payload: {
        translations: [expect.objectContaining({ title: 'Existing title' })],
      },
    });
    expect(onNext).toHaveBeenCalled();
  });

  test('a missing title blocks submission with a validation error', async () => {
    const user = userEvent.setup();
    renderStep({});
    await user.click(screen.getByRole('button', { name: 'Շարունակել' }));
    const errors = await screen.findAllByText('Այս դաշտը պարտադիր է:');
    expect(errors.length).toBeGreaterThan(0);
    expect(createMutateAsync).not.toHaveBeenCalled();
  });
});
