/**
 * FaqAccordion — COMPONENT_LIBRARY.md Part II §5 "Accordion", specialized
 * for `{question, answer}` FAQ items (`ListingFaqSection.jsx`). Panel
 * content stays in the DOM when collapsed (only `hidden` + `aria-hidden`)
 * per the spec's in-page-search preservation rule.
 */

import { useState } from 'react';
import PropTypes from 'prop-types';
import styles from './FaqAccordion.module.scss';

function ChevronIcon({ open }) {
  return (
    <svg
      className={[styles.chevron, open && styles['chevron--open']]
        .filter(Boolean)
        .join(' ')}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
ChevronIcon.propTypes = { open: PropTypes.bool.isRequired };

export default function FaqAccordion({
  items,
  allowMultipleOpen = false,
  defaultOpenIndex = undefined,
}) {
  const [openIndices, setOpenIndices] = useState(() =>
    defaultOpenIndex === undefined ? new Set() : new Set([defaultOpenIndex]),
  );

  function toggle(index) {
    setOpenIndices((current) => {
      const isOpen = current.has(index);
      if (allowMultipleOpen) {
        const next = new Set(current);
        if (isOpen) next.delete(index);
        else next.add(index);
        return next;
      }
      return isOpen ? new Set() : new Set([index]);
    });
  }

  return (
    <div className={styles.accordion}>
      {items.map((item, index) => {
        const isOpen = openIndices.has(index);
        const headerId = `faq-header-${index}`;
        const panelId = `faq-panel-${index}`;
        return (
          // eslint-disable-next-line react/no-array-index-key -- FAQ list order is stable, items carry no id
          <div className={styles.item} key={index}>
            <h3 className={styles.itemHeading}>
              <button
                type="button"
                id={headerId}
                className={styles.trigger}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(index)}
              >
                <span>{item.question}</span>
                <ChevronIcon open={isOpen} />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={headerId}
              hidden={!isOpen}
              className={styles.panel}
            >
              <p>{item.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

FaqAccordion.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      question: PropTypes.string.isRequired,
      answer: PropTypes.string.isRequired,
    }),
  ).isRequired,
  allowMultipleOpen: PropTypes.bool,
  defaultOpenIndex: PropTypes.number,
};
