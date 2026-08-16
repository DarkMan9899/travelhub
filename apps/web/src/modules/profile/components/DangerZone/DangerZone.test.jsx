import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DangerZone from './DangerZone.jsx';

describe('DangerZone (apps/web/src/modules/profile)', () => {
  test('shows an honest, non-interactive message — no delete-account button exists', () => {
    render(<DangerZone />);
    expect(screen.getByText('Վտանգավոր գոտի')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Հաշվի ինքնուրույն ջնջումը դեռ հասանելի չէ։ Եթե ցանկանում եք ջնջել ձեր հաշիվը, դիմեք աջակցության ծառայությանը։',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
