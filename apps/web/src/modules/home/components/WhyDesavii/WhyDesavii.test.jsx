import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WhyDesavii from './WhyDesavii.jsx';
import WHY_DESAVII_ITEMS from '../../constants/whyDesavii.js';

describe('WhyDesavii (apps/web/src/modules/home)', () => {
  test('renders a labeled section landmark with one heading per value item', () => {
    render(<WhyDesavii />);
    expect(screen.getByRole('region')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(
      WHY_DESAVII_ITEMS.length,
    );
  });
});
