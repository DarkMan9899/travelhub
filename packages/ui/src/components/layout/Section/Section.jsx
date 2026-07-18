/**
 * Section — vertical-rhythm page region. See Stack.jsx's file header for
 * why this exists outside COMPONENT_LIBRARY.md's catalog.
 *
 * `spacing` is intentionally a closed `default`/`none` toggle, not an
 * arbitrary scale — UI_UX_GUIDELINES.docx §5.4: "Vertical rhythm between
 * sections is always space-16 (mobile) or space-24 (desktop) — never
 * arbitrary." `none` exists only for a Section nested inside another
 * Section, where the outer one already supplies the rhythm.
 *
 * Renders a native `<section>` by default. Per WCAG/ARIA, a `<section>`
 * is only exposed as a landmark region once it has an accessible name —
 * pass `aria-label` or `aria-labelledby` when this Section should be a
 * distinct landmark; otherwise it's a plain grouping element, which is
 * equally valid for a purely visual rhythm break.
 */

import PropTypes from 'prop-types';
import styles from './Section.module.scss';

const SPACING_VALUES = ['default', 'none'];

export default function Section({
  as: Component,
  spacing,
  className,
  children,
  ...rest
}) {
  const classNames = [styles.section, styles[`spacing-${spacing}`], className]
    .filter(Boolean)
    .join(' ');

  return (
    // Polymorphic primitive: forwards arbitrary HTML attributes
    // (including aria-label/aria-labelledby) to whatever element `as`
    // resolves to, by design (see Stack.jsx).
    // eslint-disable-next-line react/jsx-props-no-spreading
    <Component className={classNames} {...rest}>
      {children}
    </Component>
  );
}

Section.propTypes = {
  as: PropTypes.elementType,
  spacing: PropTypes.oneOf(SPACING_VALUES),
  className: PropTypes.string,
  children: PropTypes.node,
};

Section.defaultProps = {
  as: 'section',
  spacing: 'default',
  className: undefined,
  children: undefined,
};

export { SPACING_VALUES as SECTION_SPACING_VALUES };
