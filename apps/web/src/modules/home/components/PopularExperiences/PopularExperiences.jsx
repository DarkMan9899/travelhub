/**
 * PopularExperiences — curated tours/attractions, presented as a premium
 * showcase carousel (`Showcase`) rather than a static grid. Placeholder
 * data (constants/experiences.js) since no experiences API exists this
 * phase.
 */

import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Section } from '@travelhub/ui/components/layout';
import POPULAR_EXPERIENCES from '../../constants/experiences.js';
import SectionHeader from '../SectionHeader/SectionHeader.jsx';
import Showcase from '../Showcase/Showcase.jsx';
import ExperienceCard from '../ExperienceCard/ExperienceCard.jsx';
import styles from './PopularExperiences.module.scss';

const HEADING_ID = 'popular-experiences-heading';

export default function PopularExperiences() {
  const { t } = useTranslation();
  const { locale } = useParams();

  return (
    <Section aria-labelledby={HEADING_ID}>
      <div className={styles.panel}>
        <SectionHeader
          id={HEADING_ID}
          eyebrow={t('home.experiences.eyebrow')}
          title={t('home.experiences.title')}
          subtitle={t('home.experiences.subtitle')}
          viewAllHref={`/${locale}/search`}
          viewAllLabel={t('home.showcase.viewAll')}
        />
        <Showcase
          ariaLabel={t('home.experiences.title')}
          slideClassName={styles.slide}
        >
          {POPULAR_EXPERIENCES.map((experience) => (
            <ExperienceCard key={experience.id} experience={experience} />
          ))}
        </Showcase>
      </div>
    </Section>
  );
}
