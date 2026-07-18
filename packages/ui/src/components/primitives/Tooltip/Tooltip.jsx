/**
 * Tooltip — COMPONENT_LIBRARY.md Part II §1 "Tooltip".
 *
 * Wraps its single child trigger (composition, not a render prop) and
 * clones it to attach hover/focus handlers and `aria-describedby` —
 * this works for both native elements and this library's own
 * components without requiring every possible trigger to forward a ref:
 * viewport-flip detection measures the wrapping `<span>` this component
 * itself renders (always a plain host element under this library's
 * control), not the arbitrary child.
 *
 * Simplification: auto-flip is a single-axis boundary check (flips to
 * the opposite side when the trigger is within `FLIP_MARGIN` of that
 * edge), not a full collision-detection engine — sufficient for a
 * tooltip's small panel, but not a Popper.js-equivalent implementation.
 */

import {
  useEffect,
  useId,
  useRef,
  useState,
  Children,
  cloneElement,
} from 'react';
import PropTypes from 'prop-types';
import useIsTouchOnlyDevice from '../../../hooks/useIsTouchOnlyDevice.js';
import styles from './Tooltip.module.scss';

const PLACEMENTS = ['top', 'bottom', 'left', 'right'];
const OPPOSITE = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
const FLIP_MARGIN = 80;

function resolvePlacement(wrapperEl, placement) {
  if (!wrapperEl) return placement;
  const rect = wrapperEl.getBoundingClientRect();
  const overflowsEdge = {
    top: rect.top < FLIP_MARGIN,
    bottom: rect.bottom > window.innerHeight - FLIP_MARGIN,
    left: rect.left < FLIP_MARGIN,
    right: rect.right > window.innerWidth - FLIP_MARGIN,
  };
  return overflowsEdge[placement] ? OPPOSITE[placement] : placement;
}

export default function Tooltip({ children, content, placement, delay }) {
  const [visible, setVisible] = useState(false);
  const [resolvedPlacement, setResolvedPlacement] = useState(placement);
  const wrapperRef = useRef(null);
  const timeoutRef = useRef(null);
  const tooltipId = useId();
  const isTouchOnly = useIsTouchOnlyDevice();

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  function show() {
    if (isTouchOnly) return;
    timeoutRef.current = setTimeout(() => {
      setResolvedPlacement(resolvePlacement(wrapperRef.current, placement));
      setVisible(true);
    }, delay);
  }

  function hide() {
    clearTimeout(timeoutRef.current);
    setVisible(false);
  }

  const trigger = Children.only(children);
  const triggerElement = cloneElement(trigger, {
    onMouseEnter: (event) => {
      trigger.props.onMouseEnter?.(event);
      show();
    },
    onMouseLeave: (event) => {
      trigger.props.onMouseLeave?.(event);
      hide();
    },
    onFocus: (event) => {
      trigger.props.onFocus?.(event);
      show();
    },
    onBlur: (event) => {
      trigger.props.onBlur?.(event);
      hide();
    },
    'aria-describedby':
      visible && !isTouchOnly ? tooltipId : trigger.props['aria-describedby'],
  });

  return (
    <span ref={wrapperRef} className={styles.wrapper}>
      {triggerElement}
      {visible && !isTouchOnly && (
        <span
          role="tooltip"
          id={tooltipId}
          className={[
            styles.tooltip,
            styles[`tooltip--${resolvedPlacement}`],
          ].join(' ')}
        >
          {content}
        </span>
      )}
    </span>
  );
}

Tooltip.propTypes = {
  children: PropTypes.element.isRequired,
  content: PropTypes.node.isRequired,
  placement: PropTypes.oneOf(PLACEMENTS),
  delay: PropTypes.number,
};

Tooltip.defaultProps = {
  placement: 'top',
  delay: 400,
};

export { PLACEMENTS as TOOLTIP_PLACEMENTS };
