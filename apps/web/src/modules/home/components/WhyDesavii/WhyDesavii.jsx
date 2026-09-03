/**
 * WhyDesavii — trust / value-proposition section. Static site content,
 * not placeholder data; only text is translated, structure is real.
 *
 * Redesign phase (2026) — "floating feature points" rather than four
 * boxed icon+text cards: each item's own box/border is gone, and a
 * single connecting path (the same route-line motif as Hero's portal
 * and Popular Experiences) draws itself across all four at laptop+,
 * where the grid is a single row and a connecting line actually reads
 * as connecting something. Below that, items still wrap into a plain
 * grid — the path is decorative connective tissue, not load-bearing
 * content, so it's fine for it to only appear where the layout supports it.
 */

import { useTranslation } from 'react-i18next';
import { Section } from '@desavii/ui/components/layout';
import { ShieldCheck, Lock, Compass, Languages } from 'lucide-react';
import WHY_DESAVII_ITEMS from '../../constants/whyDesavii.js';
import SectionHeader from '../SectionHeader/SectionHeader.jsx';
import ScrollReveal from '../ScrollReveal/ScrollReveal.jsx';
import styles from './WhyDesavii.module.scss';

const ICONS = { ShieldCheck, Lock, Compass, Languages };
const HEADING_ID = 'why-desavii-heading';

export default function WhyDesavii() {
  const { t } = useTranslation();

  return (
    <Section aria-labelledby={HEADING_ID}>
      <div className={styles.panel}>
        <ScrollReveal variant="depth">
          <SectionHeader
            id={HEADING_ID}
            eyebrow={t('home.whyDesavii.eyebrow')}
            title={t('home.whyDesavii.title')}
            subtitle={t('home.whyDesavii.subtitle')}
          />
        </ScrollReveal>
        <div className={styles.gridWrapper}>
          <svg
            className={styles.connector}
            viewBox="0 0 800 40"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <path
              className={styles.connectorPath}
              d="M50,20 C220,20 220,20 400,20 C580,20 580,20 750,20"
              fill="none"
            />
          </svg>
          <ScrollReveal stagger variant="depth" className={styles.grid}>
            {WHY_DESAVII_ITEMS.map((item) => {
              const Icon = ICONS[item.icon];
              return (
                <div key={item.id} className={styles.item}>
                  <span className={styles.iconWrapper} aria-hidden="true">
                    <Icon size={28} />
                  </span>
                  <h3 className={styles.itemTitle}>
                    {t(`home.whyDesavii.items.${item.id}.title`)}
                  </h3>
                  <p className={styles.itemDescription}>
                    {t(`home.whyDesavii.items.${item.id}.description`)}
                  </p>
                </div>
              );
            })}
          </ScrollReveal>
        </div>
      </div>
    </Section>
  );
}
