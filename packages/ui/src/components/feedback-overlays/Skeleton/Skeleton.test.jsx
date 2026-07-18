import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/react';
import Skeleton from './Skeleton.jsx';

describe('Skeleton (COMPONENT_LIBRARY.md Part II §4)', () => {
  test('marks its container aria-busy and hides placeholder bars from assistive tech', () => {
    const { container } = render(<Skeleton />);
    const region = container.firstChild;

    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(region.firstChild).toHaveAttribute('aria-hidden', 'true');
  });

  test('renders `count` repeated placeholder lines', () => {
    const { container } = render(<Skeleton count={3} />);
    expect(container.firstChild.children).toHaveLength(3);
  });

  test('supports every documented variant without throwing', () => {
    ['text', 'circle', 'rect'].forEach((variant) => {
      const { container, unmount } = render(<Skeleton variant={variant} />);
      expect(container.firstChild).toBeInTheDocument();
      unmount();
    });
  });

  test('applies explicit width/height when provided', () => {
    const { container } = render(
      <Skeleton width={80} height={80} variant="circle" />,
    );
    const bar = container.firstChild.firstChild;
    expect(bar).toHaveStyle({ width: '80px', height: '80px' });
  });
});
