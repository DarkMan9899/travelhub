/**
 * Hero — the homepage's above-the-fold section: headline, CTAs, and the
 * search widget over a local placeholder illustration (no photography
 * asset pipeline exists yet — see apps/web/src/assets/images).
 *
 * The secondary CTA is a styled `RouterLink`, not the shared `Button`
 * component: `Button`'s `secondary`/`ghost` variants are styled for a
 * light background (COMPONENT_LIBRARY.md) and would fail contrast on
 * this section's dark backdrop. Rather than adding an on-dark Button
 * variant to the whole design system for one homepage CTA, this section
 * styles its own link locally.
 */

import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@desavii/ui/components/primitives';
import { Container } from '@desavii/ui/components/layout';
import RouterLink from '../../../../components/RouterLink.jsx';
import { heroBackdrop } from '../../../../assets/images/index.js';
import ScrollReveal from '../ScrollReveal/ScrollReveal.jsx';
import SearchWidget from '../SearchWidget/SearchWidget.jsx';
import styles from './Hero.module.scss';

export default function Hero() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { locale } = useParams();

  return (
    <section className={styles.hero} aria-labelledby="home-hero-heading">
      <img
        src={heroBackdrop}
        alt=""
        aria-hidden="true"
        className={styles.backdrop}
      />
      <svg
        className={styles.compassMotif}
        viewBox="0 0 200 200"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <circle
          cx="100"
          cy="100"
          r="98"
          stroke="currentColor"
          strokeWidth="1"
        />
        <circle
          cx="100"
          cy="100"
          r="70"
          stroke="currentColor"
          strokeWidth="1"
        />
        <path
          d="M100 8v28M100 164v28M8 100h28M164 100h28"
          stroke="currentColor"
          strokeWidth="1"
        />
        <path
          d="M100 34 112 100 100 166 88 100Z"
          stroke="currentColor"
          strokeWidth="1"
        />
      </svg>
      <Container size="wide" className={styles.content}>
        {/* A multi-beat entrance — each line arrives on its own instead
            of the whole block fading in as one flat unit — reads
            meaningfully more cinematic (rich visual hierarchy over
            time, not just at rest). */}
        <div className={styles.copy}>
          <ScrollReveal delay={0}>
            <p className={styles.eyebrow}>{t('home.hero.eyebrow')}</p>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <h1 id="home-hero-heading" className={styles.title}>
              {t('home.hero.title')}
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className={styles.subtitle}>{t('home.hero.subtitle')}</p>
          </ScrollReveal>
          <ScrollReveal delay={0.3}>
            <div className={styles.ctas}>
              <Button
                variant="primary"
                size="lg"
                iconRight={<ArrowRight size={20} aria-hidden="true" />}
                onClick={() => navigate(`/${locale}/search`)}
              >
                {t('home.hero.ctaPrimary')}
              </Button>
              <RouterLink
                href={`/${locale}/partner`}
                className={styles.ctaSecondary}
              >
                {t('home.hero.ctaSecondary')}
              </RouterLink>
            </div>
          </ScrollReveal>
        </div>

        <ScrollReveal delay={0.4} className={styles.searchWrapper}>
          <SearchWidget />
        </ScrollReveal>
      </Container>
    </section>
  );
}
