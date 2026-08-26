/**
 * WizardStepActions — the Back/Continue button row every wizard step
 * ends with. Extracted once here rather than duplicated across all ten
 * steps: each step still owns *when* to call `onContinue` (usually
 * "after this step's own save mutation resolves"), this component only
 * owns the consistent layout/loading/disabled chrome around that.
 */

import PropTypes from 'prop-types';
import { Button } from '@desavii/ui/components/primitives';
import styles from './WizardStepActions.module.scss';

export default function WizardStepActions({
  onBack = undefined,
  onContinue,
  backLabel,
  continueLabel,
  isSubmitting = false,
  continueDisabled = false,
}) {
  return (
    <div className={styles.actions}>
      {onBack && (
        <Button variant="secondary" onClick={onBack} disabled={isSubmitting}>
          {backLabel}
        </Button>
      )}
      <Button
        onClick={onContinue}
        loading={isSubmitting}
        disabled={continueDisabled}
      >
        {continueLabel}
      </Button>
    </div>
  );
}

WizardStepActions.propTypes = {
  onBack: PropTypes.func,
  onContinue: PropTypes.func.isRequired,
  backLabel: PropTypes.string.isRequired,
  continueLabel: PropTypes.string.isRequired,
  isSubmitting: PropTypes.bool,
  continueDisabled: PropTypes.bool,
};
