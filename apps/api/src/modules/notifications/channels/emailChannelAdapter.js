/**
 * EmailChannelAdapter port (Phase 13).
 *
 * The whole point of this interface: `NotificationDeliveryService` (and
 * therefore every business module publishing an event) never knows or
 * cares which concrete provider is behind it. Swapping the default
 * `ConsoleEmailProvider` for a real SendGrid/Resend/SES/SMTP
 * implementation later means writing one new class implementing this
 * exact `send()` shape and changing one line in `module.container.js` —
 * zero changes anywhere else.
 */

/* eslint-disable class-methods-use-this, no-unused-vars */
export class EmailChannelAdapter {
  /**
   * @param {{subject: string, body: string}} email
   * @param {string} recipientEmail
   * @returns {Promise<{delivered: boolean, provider: string, error?: string}>}
   */
  async send(email, recipientEmail) {
    throw new Error(
      'EmailChannelAdapter.send must be implemented by a concrete adapter.',
    );
  }
}
/* eslint-enable class-methods-use-this, no-unused-vars */

export default EmailChannelAdapter;
