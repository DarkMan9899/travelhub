/**
 * Testimonials — placeholder testimonials (constants/testimonials.js);
 * not presented as verified real customer reviews, see that file's
 * header. Presented as a premium auto-advancing showcase carousel
 * (`Showcase`, which now autoplays by default). Informational only — no
 * "View all" action, unlike the other three showcase sections.
 *
 * Phase 12 (Product Polish): the section's own `subtitle` now discloses
 * these are illustrative quotes, not a verified-reviews feed — the
 * Reviews module (Phase 12) covers actual customer reviews on listing
 * pages; this section was never wired to it and would otherwise read as
 * real testimonials to a visitor.
 */

import { useTranslation } from 'react-i18next';
import { Container, Section } from '@desavii/ui/components/layout';
import TESTIMONIALS from '../../constants/testimonials.js';
import SectionHeader from '../SectionHeader/SectionHeader.jsx';
import Showcase from '../Showcase/Showcase.jsx';
import ScrollReveal from '../ScrollReveal/ScrollReveal.jsx';
import TestimonialCard from '../TestimonialCard/TestimonialCard.jsx';
import styles from './Testimonials.module.scss';

const HEADING_ID = 'testimonials-heading';

export default function Testimonials() {
  const { t } = useTranslation();

  return (
    <Section aria-labelledby={HEADING_ID}>
      <Container size="wide">
        <ScrollReveal variant="depth">
          <SectionHeader
            id={HEADING_ID}
            eyebrow={t('home.testimonials.eyebrow')}
            title={t('home.testimonials.title')}
            subtitle={t('home.testimonials.disclosure')}
          />
        </ScrollReveal>
      </Container>
      <ScrollReveal delay={0.1} variant="depth" className={styles.bleedRow}>
        <Showcase
          ariaLabel={t('home.testimonials.title')}
          slideClassName={styles.slide}
        >
          {TESTIMONIALS.map((testimonial) => (
            <TestimonialCard key={testimonial.id} testimonial={testimonial} />
          ))}
        </Showcase>
      </ScrollReveal>
    </Section>
  );
}
