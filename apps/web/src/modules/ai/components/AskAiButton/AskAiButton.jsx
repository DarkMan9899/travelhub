/**
 * AskAiButton (Phase 15 "AI Polish" sprint) — the shared contextual entry
 * point for "Ask AI about this listing" / "Ask AI about this booking" /
 * "Ask AI to improve this listing" / "Ask AI for optimization suggestions".
 * Never a second chat implementation: it owns only its own open/close state
 * and mounts the same `AiAssistantDrawer` `AiAssistantTrigger` uses,
 * passing through `contextType`/`contextId` (when the page has a real,
 * backend-supported context — `'listing'` or `'booking'`) and an
 * `initialMessage` that the drawer auto-sends once when it first opens.
 * A page with no supported context (e.g. the Partner Dashboard) passes only
 * `initialMessage` — an honest prefilled question, not a fabricated
 * context type.
 */

import { useState } from 'react';
import PropTypes from 'prop-types';
import { Sparkles } from 'lucide-react';
import { Button, Icon } from '@desavii/ui/components/primitives';
import AiAssistantDrawer from '../AiAssistantDrawer/AiAssistantDrawer.jsx';

export default function AskAiButton({
  label,
  contextType = undefined,
  contextId = undefined,
  initialMessage = undefined,
  variant = 'secondary',
  size = 'md',
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => setIsOpen(true)}
      >
        <Icon icon={Sparkles} size="sm" aria-hidden="true" />
        {label}
      </Button>
      <AiAssistantDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        contextType={contextType}
        contextId={contextId}
        initialMessage={initialMessage}
      />
    </>
  );
}

AskAiButton.propTypes = {
  label: PropTypes.string.isRequired,
  contextType: PropTypes.oneOf(['listing', 'booking']),
  contextId: PropTypes.number,
  initialMessage: PropTypes.string,
  variant: PropTypes.oneOf(['primary', 'secondary', 'ghost', 'destructive']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
};
