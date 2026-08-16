import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Testimonials from './Testimonials.jsx';
import TESTIMONIALS from '../../constants/testimonials.js';

describe('Testimonials (apps/web/src/modules/home)', () => {
  test('renders one card per placeholder testimonial inside the showcase', () => {
    render(<Testimonials />);
    expect(screen.getAllByRole('blockquote')).toHaveLength(TESTIMONIALS.length);
  });

  test('does not render a "view all" action — informational only', () => {
    render(<Testimonials />);
    expect(
      screen.queryByRole('link', { name: 'Տեսնել բոլորը' }),
    ).not.toBeInTheDocument();
  });
});
