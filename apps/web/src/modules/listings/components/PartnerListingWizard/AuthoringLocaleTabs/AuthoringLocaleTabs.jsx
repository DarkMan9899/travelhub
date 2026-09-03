/**
 * AuthoringLocaleTabs — 2026 Partner Workspace redesign (Sprint 3): the
 * one locale switcher shared by `BasicInfoStep` and `ContentStep`, the
 * two Wizard steps that author locale-specific listing content. This is
 * a deliberately independent choice from the workspace's own UI
 * language (`useParams().locale` / `LanguageSwitcher`'s `ՀՅ/РУ/EN`
 * pills) — a partner whose dashboard is in Armenian must be able to
 * author the English translation without their UI language changing
 * anything, and vice versa. Full native names ("Հայերեն"/"Русский"/
 * "English"), not the header's short pills, so the two switchers never
 * look like the same control.
 *
 * Built on the shared `Tabs` primitive (same accessible tablist pattern
 * `AdminCmsDetailContent.jsx` already established for per-locale CMS
 * translation editing) rather than a bespoke control. `Tabs.propTypes`
 * requires a plain string `label` — no icon/badge slot — so the
 * completion signal is a suffix glyph baked into that string (✓ / ·),
 * matching the exact compact format the redesign brief itself specifies
 * ("HY ✓ / RU · / EN ✓"), not a percentage or invented score.
 *
 * `Tabs` renders only `activeTab.panel` — swapping tabs normally
 * unmounts the previous one. That's fine for `AdminCmsDetailContent`
 * (each locale has its own independent `useState`/save button, so
 * losing an unsaved edit on switch was an accepted tradeoff there), but
 * this redesign explicitly requires switching authoring locale to NEVER
 * discard an unsaved edit. The fix is structural, not a workaround:
 * `children` here is rendered ONCE by the caller and passed down as a
 * single stable element, reused as every tab's `panel` — since it's the
 * exact same object reference regardless of `activeTabId`, React's
 * reconciliation never unmounts/remounts it when the active tab
 * changes; only the caller's own internal (lifted, per-locale) state
 * decides what that one persistent form instance currently shows.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Tabs } from '@desavii/ui/components/navigation';
import { SUPPORTED_LOCALES } from '../../../../../translations/i18n.js';

export default function AuthoringLocaleTabs({
  activeLocale,
  onChange,
  completionByLocale,
  ariaLabel,
  children,
}) {
  const { t } = useTranslation();

  const tabs = SUPPORTED_LOCALES.map((code) => ({
    id: code,
    label: `${t(`partner.listingWizard.contentLocale.${code}`)} ${
      completionByLocale[code] ? '✓' : '·'
    }`,
    panel: children,
  }));

  return (
    <Tabs
      tabs={tabs}
      activeTabId={activeLocale}
      onChange={onChange}
      ariaLabel={ariaLabel}
    />
  );
}

AuthoringLocaleTabs.propTypes = {
  activeLocale: PropTypes.oneOf(SUPPORTED_LOCALES).isRequired,
  onChange: PropTypes.func.isRequired,
  completionByLocale: PropTypes.objectOf(PropTypes.bool).isRequired,
  ariaLabel: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};
