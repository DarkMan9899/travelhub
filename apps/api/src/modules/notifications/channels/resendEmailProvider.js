/**
 * ResendEmailProvider — real `EmailChannelAdapter` adapter against
 * Resend's REST API (P0.3, Master Roadmap). Architecture-ready, same
 * "real adapter, never live-called without a real key configured"
 * precedent `StripePaymentProvider`/the AI provider adapters already
 * establish in this codebase: `EMAIL_PROVIDER=resend` + `RESEND_API_KEY`
 * (see config/index.js) selects it, but `ConsoleEmailProvider` stays the
 * default everywhere no key is configured.
 *
 * Resend is not the only reasonable choice (Postmark/SES/SMTP all fit
 * the same `EmailChannelAdapter` port) — it's a genuinely simple, single
 * REST-call API, which keeps this adapter small and easy to swap later
 * without over-committing this codebase to one vendor.
 */

import { EmailChannelAdapter } from './emailChannelAdapter.js';
import { getModuleLogger } from '../../../logging/logger.js';

const log = getModuleLogger('notifications:email:resend');
const API_BASE = 'https://api.resend.com';
const REQUEST_TIMEOUT_MS = 10_000;

export class ResendEmailProvider extends EmailChannelAdapter {
  #apiKey;

  #fromAddress;

  #fetchImpl;

  constructor({ apiKey, fromAddress, fetchImpl = fetch } = {}) {
    super();
    this.#apiKey = apiKey;
    this.#fromAddress = fromAddress;
    this.#fetchImpl = fetchImpl;
  }

  get isConfigured() {
    return Boolean(this.#apiKey && this.#fromAddress);
  }

  async send({ subject, body }, recipientEmail) {
    if (!this.isConfigured) {
      log.error(
        'The resend email provider is selected but RESEND_API_KEY/RESEND_FROM_ADDRESS is not configured.',
      );
      return {
        delivered: false,
        provider: 'resend',
        error: 'Resend is not configured (missing API key or from address).',
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await this.#fetchImpl(`${API_BASE}/emails`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.#apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.#fromAddress,
          to: [recipientEmail],
          subject,
          text: body,
        }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = payload?.message ?? 'Resend returned an error.';
        log.error({ status: response.status, error }, 'Resend send failed');
        return { delivered: false, provider: 'resend', error };
      }
      return { delivered: true, provider: 'resend' };
    } catch (err) {
      log.error({ err, recipientEmail }, 'Resend request failed');
      return {
        delivered: false,
        provider: 'resend',
        error: 'Failed to reach the Resend API.',
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export default ResendEmailProvider;
