/**
 * WhyDesavii — trust / value-proposition section. Static site content,
 * not placeholder data; only text is translated, structure is real.
 */

import { useTranslation } from 'react-i18next';
import { Section } from '@travelhub/ui/components/layout';
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
        <SectionHeader
          id={HEADING_ID}
          eyebrow={t('home.whyDesavii.eyebrow')}
          title={t('home.whyDesavii.title')}
          subtitle={t('home.whyDesavii.subtitle')}
        />
        <ScrollReveal stagger className={styles.grid}>
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
    </Section>
  );
}
