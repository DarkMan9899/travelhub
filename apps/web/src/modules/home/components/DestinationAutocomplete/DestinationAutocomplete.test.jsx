import { useState } from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import DestinationAutocomplete from './DestinationAutocomplete.jsx';
import { useSuggestionsQuery } from '../../../search/index.js';

vi.mock('../../../search/index.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useSuggestionsQuery: vi.fn() };
});

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => navigateMock };
});

function Harness() {
  const [value, setValue] = useState('');
  return (
    <DestinationAutocomplete
      value={value}
      onChange={(event) => setValue(event.target.value)}
      label="Destination"
    />
  );
}

function renderHarness() {
  return render(
    <MemoryRouter initialEntries={['/en']}>
      <Routes>
        <Route path="/:locale" element={<Harness />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DestinationAutocomplete (apps/web/src/modules/home)', () => {
  test('renders as a combobox with no suggestions initially', () => {
    useSuggestionsQuery.mockReturnValue({ data: [], isPending: false });
    renderHarness();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  test('shows a listbox of real suggestions once typed', async () => {
    useSuggestionsQuery.mockReturnValue({
      data: [
        { id: 2, title: 'Yerevan Grand Hotel', slug: 'yerevan-grand-hotel' },
      ],
      isPending: false,
    });
    const user = userEvent.setup();
    renderHarness();

    await user.type(screen.getByRole('combobox'), 'Yerevan');

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Yerevan Grand Hotel' }),
    ).toBeInTheDocument();
  });

  test('navigates to the listing detail route when a suggestion is selected', async () => {
    useSuggestionsQuery.mockReturnValue({
      data: [
        { id: 2, title: 'Yerevan Grand Hotel', slug: 'yerevan-grand-hotel' },
      ],
      isPending: false,
    });
    const user = userEvent.setup();
    renderHarness();

    await user.type(screen.getByRole('combobox'), 'Yerevan');
    await user.click(
      screen.getByRole('option', { name: 'Yerevan Grand Hotel' }),
    );

    expect(navigateMock).toHaveBeenCalledWith('/en/listings/2');
  });
});
