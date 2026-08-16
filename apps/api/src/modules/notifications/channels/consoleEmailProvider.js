/**
 * ConsoleEmailProvider — the default `EmailChannelAdapter` implementation
 * (Phase 13). Per the brief: "do NOT integrate a real provider yet."
 * This is a real, observable dispatch path (a structured log line), not
 * a silent no-op — useful for verifying the whole event-to-delivery
 * chain works end to end without an external dependency/API key.
 *
 * A real provider (SendGrid/Resend/SES/SMTP) later implements this same
 * `send()` shape and is swapped in at `module.container.js` — nothing
 * else in this module changes.
 */

import { EmailChannelAdapter } from './emailChannelAdapter.js';
import { getModuleLogger } from '../../../logging/logger.js';

const log = getModuleLogger('notifications:email');

export class ConsoleEmailProvider extends EmailChannelAdapter {
  async send({ subject, body }, recipientEmail) {
    log.info(
      { recipientEmail, subject, body },
      'Email delivery (ConsoleEmailProvider — no real provider configured)',
    );
    return { delivered: true, provider: 'console' };
  }
}

export default ConsoleEmailProvider;
