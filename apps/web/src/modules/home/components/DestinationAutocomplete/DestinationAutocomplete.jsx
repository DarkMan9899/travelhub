/**
 * DestinationAutocomplete — the Hero search bar's destination field.
 * Backed by the real `GET /search/suggestions` typeahead
 * (`useSuggestionsQuery`, the `search` module's public export, §6.3's
 * cross-module rule) — selecting a suggestion navigates straight to that
 * listing's detail page. Plain free text is left alone for the parent
 * form's normal `?destination=` submit (`SearchWidget`).
 *
 * Follows the same WAI-ARIA combobox/listbox/`aria-activedescendant`
 * pattern `Select.jsx` already uses, for a consistent a11y story rather
 * than a second one-off pattern.
 */

import { useEffect, useId, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate, useParams } from 'react-router-dom';
import { Input } from '@desavii/ui/components/form-controls';
import { useSuggestionsQuery } from '../../../search/index.js';
import styles from './DestinationAutocomplete.module.scss';

const DEBOUNCE_MS = 300;

export default function DestinationAutocomplete({
  value,
  onChange,
  label = undefined,
  placeholder = undefined,
  iconLeft = undefined,
  ...rest
}) {
  const navigate = useNavigate();
  const { locale } = useParams();
  const [debouncedValue, setDebouncedValue] = useState(value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedValue(value), DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [value]);

  const { data: suggestions = [] } = useSuggestionsQuery(debouncedValue, {
    locale,
  });
  const showPanel = open && suggestions.length > 0;

  useEffect(() => {
    if (!open) return undefined;

    function handleClickOutside(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function selectSuggestion(suggestion) {
    setOpen(false);
    setActiveIndex(-1);
    navigate(`/${locale}/listings/${suggestion.id}`);
  }

  function handleKeyDown(event) {
    if (!showPanel) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((current) => (current + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex(
          (current) => (current - 1 + suggestions.length) % suggestions.length,
        );
        break;
      case 'Enter':
        if (activeIndex >= 0) {
          event.preventDefault();
          selectSuggestion(suggestions[activeIndex]);
        }
        break;
      case 'Escape':
        setOpen(false);
        setActiveIndex(-1);
        break;
      default:
        break;
    }
  }

  return (
    <div className={styles.wrapper} ref={containerRef}>
      <Input
        label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onChange(event);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onKeyDown={(event) => handleKeyDown(event)}
        iconLeft={iconLeft}
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
        }
        autoComplete="off"
        // Forwards aria-label (used when the visible `label` is omitted
        // for a compact layout) straight through to the underlying Input,
        // the same polymorphic-forwarding pattern Input itself uses.
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...rest}
      />
      {showPanel && (
        <ul id={listboxId} role="listbox" className={styles.panel}>
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.id}
              id={`${listboxId}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className={[
                styles.option,
                index === activeIndex && styles['option--active'],
              ]
                .filter(Boolean)
                .join(' ')}
              onMouseEnter={() => setActiveIndex(index)}
              // `mousedown` (not `click`) fires before the input's blur /
              // click-outside handler, so the selection registers before
              // the panel closes itself.
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events -- keyboard selection is handled via Enter in handleKeyDown above; this is the pointer path only.
              onMouseDown={(event) => {
                event.preventDefault();
                selectSuggestion(suggestion);
              }}
            >
              {suggestion.title}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

DestinationAutocomplete.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  label: PropTypes.string,
  placeholder: PropTypes.string,
  iconLeft: PropTypes.node,
};
