import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ListingAboutSection from './ListingAboutSection.jsx';

describe('ListingAboutSection (Phase 18)', () => {
  test('renders nothing when there is no description', () => {
    const { container } = render(
      <ListingAboutSection description={null} sectionId="about" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  test('renders a short description with no show-more toggle', () => {
    render(
      <ListingAboutSection description="A cozy villa." sectionId="about" />,
    );
    expect(screen.getByText('A cozy villa.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('a long description shows a toggle that expands the text', async () => {
    const user = userEvent.setup();
    const longText = 'A'.repeat(500);
    render(<ListingAboutSection description={longText} sectionId="about" />);

    const toggle = screen.getByRole('button');
    await user.click(toggle);
    expect(screen.getByText(longText)).toBeInTheDocument();
  });

  test('gives the heading the passed sectionId for the section-nav anchor', () => {
    render(
      <ListingAboutSection description="A cozy villa." sectionId="about" />,
    );
    expect(
      screen.getByRole('heading', { name: 'Այս հայտարարության մասին' }),
    ).toHaveAttribute('id', 'about');
  });
});
