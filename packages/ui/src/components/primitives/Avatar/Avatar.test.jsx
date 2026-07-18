import { describe, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Avatar from './Avatar.jsx';

describe('Avatar (COMPONENT_LIBRARY.md Part II §1)', () => {
  test('renders initials fallback with an accessible name when no src is given', () => {
    render(<Avatar name="Ani Petrosyan" />);
    const fallback = screen.getByRole('img', { name: 'Ani Petrosyan' });
    expect(fallback).toBeInTheDocument();
    expect(fallback).toHaveTextContent('AP');
  });

  test('shows a Skeleton until the image loads, then reveals the image with alt=name', () => {
    const { container } = render(
      <Avatar name="Davit Kirakosyan" src="https://example.com/avatar.jpg" />,
    );

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();

    const image = screen.getByAltText('Davit Kirakosyan');
    fireEvent.load(image);

    expect(
      container.querySelector('[aria-busy="true"]'),
    ).not.toBeInTheDocument();
  });

  test('falls back to initials if the image fails to load', () => {
    render(
      <Avatar name="Mane Sargsyan" src="https://example.com/broken.jpg" />,
    );

    const image = screen.getByAltText('Mane Sargsyan');
    fireEvent.error(image);

    expect(
      screen.getByRole('img', { name: 'Mane Sargsyan' }),
    ).toHaveTextContent('MS');
  });

  test('the fallback background is deterministic for the same seed', () => {
    const { container: first } = render(
      <Avatar name="Same Seed" userId="user-123" />,
    );
    const { container: second } = render(
      <Avatar name="Same Seed" userId="user-123" />,
    );

    expect(first.firstChild.firstChild.className).toBe(
      second.firstChild.firstChild.className,
    );
  });

  test('supports every documented size without throwing', () => {
    ['sm', 'md', 'lg', 'xl'].forEach((size) => {
      const { unmount } = render(<Avatar name="Test User" size={size} />);
      expect(screen.getByRole('img')).toBeInTheDocument();
      unmount();
    });
  });
});
