import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ToastProvider from '../../../../providers/ToastProvider.jsx';
import PartnerProfilePageContent from './PartnerProfilePageContent.jsx';
import { usePartnerContext } from '../../../../contexts/PartnerContext.jsx';
import { useMyCompanyProfileQuery } from '../../queries/useMyCompanyProfileQuery.js';
import { useUpdateCompanyProfileMutation } from '../../mutations/useUpdateCompanyProfileMutation.js';
import { useUploadCompanyLogoMutation } from '../../mutations/useUploadCompanyLogoMutation.js';
import { useUploadCompanyCoverMutation } from '../../mutations/useUploadCompanyCoverMutation.js';

vi.mock('../../../../contexts/PartnerContext.jsx', () => ({
  usePartnerContext: vi.fn(),
}));
vi.mock('../../queries/useMyCompanyProfileQuery.js', () => ({
  useMyCompanyProfileQuery: vi.fn(),
}));
vi.mock('../../mutations/useUpdateCompanyProfileMutation.js', () => ({
  useUpdateCompanyProfileMutation: vi.fn(),
}));
vi.mock('../../mutations/useUploadCompanyLogoMutation.js', () => ({
  useUploadCompanyLogoMutation: vi.fn(),
}));
vi.mock('../../mutations/useUploadCompanyCoverMutation.js', () => ({
  useUploadCompanyCoverMutation: vi.fn(),
}));

const PROFILE = {
  id: 3,
  slug: 'sevan-lakeside-tours',
  display_name: 'Sevan Lakeside Tours',
  email: 'contact@sevanlakeside.example',
  phone: '+37400000000',
  website: 'https://sevanlakeside.example',
  logo_url: null,
  cover_url: null,
  is_verified: true,
  social_links: { facebook: 'https://facebook.com/sevan' },
  translations: [
    { language_id: 2, language_code: 'hy', description: 'Մեր մասին' },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/partner/profile']}>
      <ToastProvider>
        <Routes>
          <Route
            path="/:locale/partner/profile"
            element={<PartnerProfilePageContent />}
          />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('PartnerProfilePageContent (apps/web/src/modules/partner)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePartnerContext.mockReturnValue({
      activePartnerId: 3,
      activePartner: { role: 'OWNER' },
    });
    useUploadCompanyLogoMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    useUploadCompanyCoverMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
  });

  test('shows a loading skeleton while pending', () => {
    useMyCompanyProfileQuery.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    });
    useUpdateCompanyProfileMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    renderPage();

    expect(
      screen.queryByLabelText('Հանրային բիզնես անվանում'),
    ).not.toBeInTheDocument();
  });

  test('shows a retryable error state', () => {
    const refetch = vi.fn();
    useMyCompanyProfileQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch,
    });
    useUpdateCompanyProfileMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    renderPage();

    expect(
      screen.getByText('Չհաջողվեց բեռնել ձեր ընկերության պրոֆիլը։'),
    ).toBeInTheDocument();
  });

  test('renders the current profile, resolving the description for the active locale', async () => {
    useMyCompanyProfileQuery.mockReturnValue({
      data: PROFILE,
      isPending: false,
      isError: false,
    });
    useUpdateCompanyProfileMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    renderPage();

    expect(
      await screen.findByDisplayValue('Sevan Lakeside Tours'),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('Մեր մասին')).toBeInTheDocument();
  });

  test('an OWNER can save profile changes, sending the active locale for the description', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue({});
    useMyCompanyProfileQuery.mockReturnValue({
      data: PROFILE,
      isPending: false,
      isError: false,
    });
    useUpdateCompanyProfileMutation.mockReturnValue({
      mutateAsync,
      isPending: false,
    });
    renderPage();

    const nameInput = await screen.findByDisplayValue('Sevan Lakeside Tours');
    await user.clear(nameInput);
    await user.type(nameInput, 'Sevan Lakeside Tours LLC');
    await user.click(
      screen.getByRole('button', { name: 'Պահպանել փոփոխությունները' }),
    );

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'Sevan Lakeside Tours LLC',
          locale: 'hy',
          description: 'Մեր մասին',
        }),
      );
    });
  });

  test('a verified partner sees the verified badge and a link to the real public company page', async () => {
    useMyCompanyProfileQuery.mockReturnValue({
      data: PROFILE,
      isPending: false,
      isError: false,
    });
    useUpdateCompanyProfileMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    renderPage();

    await screen.findByDisplayValue('Sevan Lakeside Tours');
    expect(screen.getByText('Ստուգված')).toBeInTheDocument();
    const publicLink = screen.getByRole('link', {
      name: /Դիտել հանրային էջը/,
    });
    expect(publicLink).toHaveAttribute(
      'href',
      '/hy/companies/sevan-lakeside-tours',
    );
  });

  test('an unverified partner sees no verified badge, but still sees the public-profile relationship note', async () => {
    useMyCompanyProfileQuery.mockReturnValue({
      data: { ...PROFILE, is_verified: false },
      isPending: false,
      isError: false,
    });
    useUpdateCompanyProfileMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    renderPage();

    await screen.findByDisplayValue('Sevan Lakeside Tours');
    expect(screen.queryByText('Ստուգված')).not.toBeInTheDocument();
    expect(
      screen.getByText(/Գործընկերոջ աշխատավայրի պրոֆիլի խմբագրիչն է/),
    ).toBeInTheDocument();
  });

  test('a non-manager role (EDITOR) sees a read-only form with no save action', async () => {
    usePartnerContext.mockReturnValue({
      activePartnerId: 3,
      activePartner: { role: 'EDITOR' },
    });
    useMyCompanyProfileQuery.mockReturnValue({
      data: PROFILE,
      isPending: false,
      isError: false,
    });
    useUpdateCompanyProfileMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    renderPage();

    const nameInput = await screen.findByDisplayValue('Sevan Lakeside Tours');
    expect(nameInput).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Պահպանել փոփոխությունները' }),
    ).not.toBeInTheDocument();
  });
});
