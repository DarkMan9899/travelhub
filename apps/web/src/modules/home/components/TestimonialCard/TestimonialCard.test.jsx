import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TestimonialCard from './TestimonialCard.jsx';

const TESTIMONIAL = { id: 'testimonial-1', rating: 5 };

describe('TestimonialCard (apps/web/src/modules/home)', () => {
  test('renders a rating and a quote', () => {
    render(<TestimonialCard testimonial={TESTIMONIAL} />);
    expect(screen.getByRole('img', { name: /5\.0/ })).toBeInTheDocument();
    expect(screen.getByRole('blockquote')).toBeInTheDocument();
  });
});
