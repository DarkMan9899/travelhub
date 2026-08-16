import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ListingFaqSection from './ListingFaqSection.jsx';

describe('ListingFaqSection (Phase 18)', () => {
  test('renders nothing when there are no FAQs', () => {
    const { container } = render(<ListingFaqSection faqs={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('renders the heading and each question', () => {
    render(
      <ListingFaqSection
        faqs={[{ question: 'Is breakfast included?', answer: 'Yes.' }]}
        sectionId="faq"
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Հաճախակի տրվող հարցեր' }),
    ).toHaveAttribute('id', 'faq');
    expect(screen.getByText('Is breakfast included?')).toBeInTheDocument();
  });
});
