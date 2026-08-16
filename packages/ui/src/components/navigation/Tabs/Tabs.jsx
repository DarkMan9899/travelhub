/**
 * Tabs — COMPONENT_LIBRARY.md Part II §3 "Tabs". Full WAI-ARIA tabs
 * pattern: tablist (roving tabindex + arrow-key navigation) and the
 * active tabpanel, both owned here — every real consumer
 * (`AdminCmsDetailContent.jsx`, `AdminSettingsPageContent.jsx`,
 * `AdminMarketplaceConfigPageContent.jsx`,
 * `AdminInventoryPageContent.jsx`, `PartnerConnectionsPageContent.jsx`)
 * passes each tab's content as `tabs[].panel` rather than rendering its
 * own tabpanel separately.
 */

import PropTypes from 'prop-types';
import styles from './Tabs.module.scss';

export default function Tabs({ tabs, activeTabId, onChange, ariaLabel }) {
  function handleKeyDown(event, index) {
    const enabledTabs = tabs.filter((tab) => !tab.disabled);
    const currentPos = enabledTabs.findIndex(
      (tab) => tab.id === tabs[index].id,
    );

    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      const nextPos =
        (currentPos + delta + enabledTabs.length) % enabledTabs.length;
      onChange(enabledTabs[nextPos].id);
    }
  }

  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  return (
    <div>
      <div role="tablist" aria-label={ariaLabel} className={styles.tabs}>
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              disabled={tab.disabled}
              className={[styles.tab, isActive && styles['tab--active']]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onChange(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {activeTab && (
        <div
          role="tabpanel"
          id={`tabpanel-${activeTab.id}`}
          aria-labelledby={`tab-${activeTab.id}`}
          tabIndex={0}
          className={styles.panel}
        >
          {activeTab.panel}
        </div>
      )}
    </div>
  );
}

Tabs.propTypes = {
  tabs: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      disabled: PropTypes.bool,
      panel: PropTypes.node,
    }),
  ).isRequired,
  activeTabId: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  ariaLabel: PropTypes.string.isRequired,
};
