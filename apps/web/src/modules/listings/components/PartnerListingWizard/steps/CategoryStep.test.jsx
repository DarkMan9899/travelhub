import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CategoryStep from './CategoryStep.jsx';
import { useListingCategoriesQuery } from '../../../queries/useListingCategoriesQuery.js';

vi.mock('../../../queries/useListingCategoriesQuery.js', () => ({
  useListingCategoriesQuery: vi.fn(),
}));

function renderStep(props) {
  return render(
    <MemoryRouter initialEntries={['/hy/partner/listings/new']}>
      <Routes>
        <Route
          path="/:locale/partner/listings/new"
          element={
            <CategoryStep
              value={null}
              onChange={vi.fn()}
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

describe('CategoryStep (PartnerListingWizard)', () => {
  test('renders a loading spinner while categories are pending', () => {
    useListingCategoriesQuery.mockReturnValue({ isPending: true });
    renderStep({});
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  test('forwards the current URL locale to useListingCategoriesQuery', () => {
    useListingCategoriesQuery.mockReturnValue({ isPending: true });
    renderStep({});
    expect(useListingCategoriesQuery).toHaveBeenCalledWith('hy');
  });

  test('renders an ErrorState with retry on failure', async () => {
    const refetch = vi.fn();
    const user = userEvent.setup();
    useListingCategoriesQuery.mockReturnValue({
      isPending: false,
      isError: true,
      refetch,
    });
    renderStep({});
    await user.click(screen.getByRole('button', { name: 'Կրկնել' }));
    expect(refetch).toHaveBeenCalled();
  });

  test('renders every category as a selectable radio card', () => {
    useListingCategoriesQuery.mockReturnValue({
      isPending: false,
      isError: false,
      data: [
        { id: 1, slug: 'villas', name: 'Villas', listing_count: 4 },
        { id: 2, slug: 'hotels', name: 'Hotels', listing_count: 10 },
      ],
    });
    renderStep({ value: 1 });

    expect(screen.getByRole('radio', { name: 'Villas' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: 'Hotels' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  test('clicking a category card calls onChange with its id', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    useListingCategoriesQuery.mockReturnValue({
      isPending: false,
      isError: false,
      data: [{ id: 2, slug: 'hotels', name: 'Hotels', listing_count: 10 }],
    });
    renderStep({ onChange });

    await user.click(screen.getByRole('radio', { name: 'Hotels' }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  test('Continue is disabled until a category is selected', () => {
    useListingCategoriesQuery.mockReturnValue({
      isPending: false,
      isError: false,
      data: [{ id: 2, slug: 'hotels', name: 'Hotels', listing_count: 10 }],
    });
    const { rerender } = render(
      <MemoryRouter initialEntries={['/hy/partner/listings/new']}>
        <Routes>
          <Route
            path="/:locale/partner/listings/new"
            element={
              <CategoryStep value={null} onChange={vi.fn()} onNext={vi.fn()} />
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Շարունակել' })).toBeDisabled();

    rerender(
      <MemoryRouter initialEntries={['/hy/partner/listings/new']}>
        <Routes>
          <Route
            path="/:locale/partner/listings/new"
            element={
              <CategoryStep value={2} onChange={vi.fn()} onNext={vi.fn()} />
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('button', { name: 'Շարունակել' }),
    ).not.toBeDisabled();
  });

  test('clicking Continue calls onNext', async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    useListingCategoriesQuery.mockReturnValue({
      isPending: false,
      isError: false,
      data: [{ id: 2, slug: 'hotels', name: 'Hotels', listing_count: 10 }],
    });
    renderStep({ value: 2, onNext });
    await user.click(screen.getByRole('button', { name: 'Շարունակել' }));
    expect(onNext).toHaveBeenCalled();
  });
});
