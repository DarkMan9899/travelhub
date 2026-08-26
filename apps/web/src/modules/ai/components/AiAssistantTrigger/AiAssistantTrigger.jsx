/**
 * AiAssistantTrigger — the AI Assistant's entry point, added to every
 * protected/public layout's `actions` fragment next to
 * `NotificationBell`/`MessagingBell` (Stage 15.3), the identical insertion
 * point Phase 13/14 already established. Renders `null` for a logged-out
 * visitor, matching `NotificationBell`'s/`FavoriteButton`'s precedent —
 * the assistant's conversations are always the requester's own.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { Icon } from '@desavii/ui/components/primitives';
import { useAuth } from '../../../../contexts/AuthContext.jsx';
import AiAssistantDrawer from '../AiAssistantDrawer/AiAssistantDrawer.jsx';
import styles from './AiAssistantTrigger.module.scss';

export default function AiAssistantTrigger() {
  const { t } = useTranslation();
  const { isAuthenticated, isBootstrapping } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (isBootstrapping || !isAuthenticated) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={t('ai.assistant.triggerLabel')}
        onClick={() => setIsOpen(true)}
      >
        <Icon icon={Sparkles} size="md" />
      </button>
      <AiAssistantDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
