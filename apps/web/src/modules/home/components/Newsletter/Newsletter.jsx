/**
 * Newsletter — UI-only "subscribe" form (React Hook Form + `Controller`
 * wrapping the shared `Input`, mirroring `LoginForm`'s pattern). No
 * newsletter API exists this phase; `useNewsletterSubscribe` only
 * manages local success UI state, never a real subscription.
 *
 * A single centered composition on a dark, Hero-echoing gradient panel
 * (icon, heading, subtitle, inline form) rather than a two-column split
 * — the two-column layout left large stretches of empty horizontal
 * space at in-between widths; a confidently-proportioned centered CTA
 * reads as an intentional banner instead.
 */

import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Mail } from 'lucide-react';
import { Section } from '@travelhub/ui/components/layout';
import { Input } from '@travelhub/ui/components/form-controls';
import { Button } from '@travelhub/ui/components/primitives';
import ScrollReveal from '../ScrollReveal/ScrollReveal.jsx';
import useNewsletterSubscribe from '../../hooks/useNewsletterSubscribe.js';
import styles from './Newsletter.module.scss';

const HEADING_ID = 'newsletter-heading';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Newsletter() {
  const { t } = useTranslation();
  const { status, subscribe } = useNewsletterSubscribe();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ defaultValues: { email: '' } });

  function onSubmit() {
    subscribe();
    reset();
  }

  return (
    <Section aria-labelledby={HEADING_ID}>
      <ScrollReveal className={styles.panel}>
        <span className={styles.iconWrapper} aria-hidden="true">
          <Mail size={28} />
        </span>
        <h2 id={HEADING_ID} className={styles.title}>
          {t('home.newsletter.title')}
        </h2>
        <p className={styles.subtitle}>{t('home.newsletter.subtitle')}</p>

        {status === 'success' ? (
          <p className={styles.success} role="status">
            {t('home.newsletter.successMessage')}
          </p>
        ) : (
          <form
            className={styles.form}
            onSubmit={handleSubmit(onSubmit)}
            noValidate
          >
            <div className={styles.field}>
              <Controller
                name="email"
                control={control}
                rules={{
                  required: t('home.newsletter.emailRequired'),
                  pattern: {
                    value: EMAIL_PATTERN,
                    message: t('home.newsletter.emailInvalid'),
                  },
                }}
                render={({ field }) => (
                  <Input
                    type="email"
                    size="lg"
                    aria-label={t('home.newsletter.emailLabel')}
                    placeholder={t('home.newsletter.emailPlaceholder')}
                    required
                    error={errors.email?.message}
                    // eslint-disable-next-line react/jsx-props-no-spreading
                    {...field}
                  />
                )}
              />
            </div>
            <Button type="submit" variant="primary" size="lg">
              {t('home.newsletter.submit')}
            </Button>
          </form>
        )}
      </ScrollReveal>
    </Section>
  );
}
