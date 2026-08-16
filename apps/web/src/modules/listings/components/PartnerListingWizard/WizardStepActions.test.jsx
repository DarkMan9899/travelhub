import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WizardStepActions from './WizardStepActions.jsx';

describe('WizardStepActions (PartnerListingWizard)', () => {
  test('renders only the Continue button when onBack is not provided', () => {
    render(
      <WizardStepActions
        onContinue={vi.fn()}
        backLabel="Back"
        continueLabel="Continue"
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Back' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Continue' }),
    ).toBeInTheDocument();
  });

  test('renders Back when onBack is provided and calls it on click', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(
      <WizardStepActions
        onBack={onBack}
        onContinue={vi.fn()}
        backLabel="Back"
        continueLabel="Continue"
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalled();
  });

  test('calls onContinue on click', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(
      <WizardStepActions
        onContinue={onContinue}
        backLabel="Back"
        continueLabel="Continue"
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalled();
  });

  test('disables Back (but not Continue via disabled — it shows a loading state) while isSubmitting', () => {
    render(
      <WizardStepActions
        onBack={vi.fn()}
        onContinue={vi.fn()}
        backLabel="Back"
        continueLabel="Continue"
        isSubmitting
      />,
    );
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
  });

  test('disables Continue when continueDisabled is true', () => {
    render(
      <WizardStepActions
        onContinue={vi.fn()}
        backLabel="Back"
        continueLabel="Continue"
        continueDisabled
      />,
    );
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });
});
