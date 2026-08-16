import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ListingMap from './ListingMap.jsx';

describe('ListingMap (PartnerListingWizard/Listing Details)', () => {
  test('renders a map region with the given popup label as its accessible name', () => {
    render(
      <ListingMap
        latitude={40.1872}
        longitude={44.5152}
        popupLabel="Villa in Yerevan, Armenia"
      />,
    );
    expect(
      screen.getByRole('region', { name: 'Villa in Yerevan, Armenia' }),
    ).toBeInTheDocument();
  });

  test('clicking the marker opens a popup with the label', async () => {
    const user = userEvent.setup();
    render(
      <ListingMap
        latitude={40.1872}
        longitude={44.5152}
        popupLabel="Villa in Yerevan, Armenia"
      />,
    );

    expect(
      screen.queryByText('Villa in Yerevan, Armenia'),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Marker' }));
    expect(screen.getByText('Villa in Yerevan, Armenia')).toBeInTheDocument();
  });
});
