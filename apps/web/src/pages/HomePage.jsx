/**
 * HomePage — the real Customer Website homepage (FRONTEND_ARCHITECTURE.md
 * §3.1's `pages/` contract: thinnest possible layer, composing a layout
 * region and the owning module's content, no `useQuery`/`useMutation` of
 * its own). Phase 3 extends Phase 1's Hero + FeaturedListings with the
 * rest of the marketplace homepage — every section below is real `home`
 * module content, composed here in display order.
 */

import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Container } from '@travelhub/ui/components/layout';
import {
  Hero,
  FeaturedDestinations,
  FeaturedListings,
  PopularExperiences,
  Categories,
  WhyDesavii,
  PartnerCta,
  Testimonials,
} from '../modules/home/index.js';
import useSeo from '../seo/useSeo.js';

export default function HomePage() {
  const { t } = useTranslation();
  const { locale } = useParams();

  useSeo({
    title: t('seo.home.title'),
    description: t('seo.home.description'),
    locale,
    path: '',
  });

  return (
    <Container size="wide">
      <Hero />
      <FeaturedDestinations />
      <FeaturedListings />
      <PopularExperiences />
      <Categories />
      <WhyDesavii />
      <PartnerCta />
      <Testimonials />
    </Container>
  );
}
