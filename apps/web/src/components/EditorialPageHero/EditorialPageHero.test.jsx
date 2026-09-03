import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Compass } from 'lucide-react';
import EditorialPageHero from './EditorialPageHero.jsx';

const BREADCRUMBS = [
  { label: 'Home', href: '/en' },
  { label: 'About', href: '/en/about' },
];

function renderHero(props = {}) {
  return render(
    <MemoryRouter initialEntries={['/en/about']}>
      <Routes>
        <Route
          path="/:locale/about"
          element={
            <EditorialPageHero
              breadcrumbItems={BREADCRUMBS}
              heroSeed="about"
              title="About desavii"
              lead="Our story"
              // eslint-disable-next-line react/jsx-props-no-spreading -- test helper forwards arbitrary props
              {...props}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('EditorialPageHero (apps/web/src/components)', () => {
  test('renders exactly one H1 and one breadcrumb nav', () => {
    renderHero();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'About desavii',
    );
    expect(
      screen.getAllByRole('navigation', { name: 'Breadcrumb' }),
    ).toHaveLength(1);
  });

  test('renders the lead paragraph when provided', () => {
    renderHero();
    expect(screen.getByText('Our story')).toBeInTheDocument();
  });

  test('omits the lead paragraph when not provided', () => {
    renderHero({ lead: undefined });
    expect(screen.queryByText('Our story')).not.toBeInTheDocument();
  });

  test('renders the icon only when one is passed', () => {
    const { container, rerender } = render(
      <MemoryRouter initialEntries={['/en/about']}>
        <Routes>
          <Route
            path="/:locale/about"
            element={
              <EditorialPageHero
                breadcrumbItems={BREADCRUMBS}
                heroSeed="about"
                title="About desavii"
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(container.querySelector('[class*="heroIcon"]')).toBeNull();

    rerender(
      <MemoryRouter initialEntries={['/en/about']}>
        <Routes>
          <Route
            path="/:locale/about"
            element={
              <EditorialPageHero
                breadcrumbItems={BREADCRUMBS}
                heroSeed="about"
                title="About desavii"
                icon={Compass}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(container.querySelector('[class*="heroIcon"]')).not.toBeNull();
  });

  test('renders extra children inside the hero content (e.g. a CTA)', () => {
    renderHero({ children: <button type="button">Get started</button> });
    expect(
      screen.getByRole('button', { name: 'Get started' }),
    ).toBeInTheDocument();
  });
});
