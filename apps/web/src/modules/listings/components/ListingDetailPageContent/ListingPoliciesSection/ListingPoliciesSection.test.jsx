import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ListingPoliciesSection from './ListingPoliciesSection.jsx';

describe('ListingPoliciesSection (Listing Details)', () => {
  test('renders nothing when the category has no policies', () => {
    const { container } = render(
      <ListingPoliciesSection policies={[]} listing={{ policy_values: [] }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  test('renders nothing when none of the policies have a listing value', () => {
    const { container } = render(
      <ListingPoliciesSection
        policies={[{ code: 'pets_allowed', data_type: 'BOOLEAN' }]}
        listing={{ policy_values: [] }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  test('renders the heading and a translated BOOLEAN policy value', () => {
    render(
      <ListingPoliciesSection
        policies={[{ code: 'pets_allowed', data_type: 'BOOLEAN' }]}
        listing={{ policy_values: [{ code: 'pets_allowed', value: 'true' }] }}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Կանոններ' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Կենդանիներ թույլատրվում են')).toBeInTheDocument();
    expect(screen.getByText('Այո')).toBeInTheDocument();
  });

  test('renders a STRING policy plainly', () => {
    render(
      <ListingPoliciesSection
        policies={[{ code: 'check_in_time', data_type: 'STRING' }]}
        listing={{ policy_values: [{ code: 'check_in_time', value: '14:00' }] }}
      />,
    );
    expect(screen.getByText('14:00')).toBeInTheDocument();
  });
});
