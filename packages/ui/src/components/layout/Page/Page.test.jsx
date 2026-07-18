import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page from './Page.jsx';

describe('Page (layout primitive)', () => {
  test('renders an <h1> when title is given', () => {
    render(<Page title="Search results">Body</Page>);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Search results' }),
    ).toBeInTheDocument();
  });

  test('renders no heading when title is omitted', () => {
    render(<Page>Body</Page>);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  test('renders children', () => {
    render(<Page title="Test">Body content</Page>);
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });
});
