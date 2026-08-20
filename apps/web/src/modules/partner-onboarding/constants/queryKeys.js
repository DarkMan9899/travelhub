/**
 * Partner-onboarding query-key factory (FRONTEND_ARCHITECTURE.md §14.1)
 * — P1.2 (Master Roadmap). Deliberately its own module/key namespace,
 * not folded into `modules/partner/constants/queryKeys.js`: that
 * module's `GET /partners/mine` is approved-only (feeds
 * `RequirePartner`'s dashboard gate), while this one's `GET /partners/
 * applications` is unfiltered — a real, deliberate difference, not two
 * names for the same concept.
 */

const onboardingKeys = {
  all: ['partnerOnboarding'],
  myApplications: () => [...onboardingKeys.all, 'myApplications'],
  application: (id) => [...onboardingKeys.all, 'application', id],
};

export default onboardingKeys;
