/**
 * DestinationArt — shared procedural backdrop (redesign phase, 2026).
 *
 * No real per-destination/category photography asset pipeline exists yet
 * (see `assets/images/index.js`'s own "swap for a real production asset
 * later" framing) — before this component, every destination card shared
 * one identical static illustration (`destinationMotif.svg`), which is
 * exactly the "flat, repeated" look the redesign brief calls out. This
 * replaces it with a deterministic-but-varied treatment: a gradient mesh
 * (`@desavii/ui`'s `mesh-for-index()`, five brand-derived variants) paired
 * with one of five simple line-art motifs, both keyed off the same
 * `seed` (a destination/category/listing id) — so the same item always
 * renders the same art, and a grid of different items reads as varied,
 * not one recolored illustration. Purely decorative (`aria-hidden`);
 * callers still supply their own real `alt`/heading text for the actual
 * content.
 */

import PropTypes from 'prop-types';
import styles from './DestinationArt.module.scss';

const MOTIFS = ['compass', 'peaks', 'sun-waves', 'starburst', 'arch'];

function Motif({ name }) {
  switch (name) {
    case 'peaks':
      return (
        <path
          d="M0 78 L18 52 L34 68 L52 34 L72 62 L88 46 L100 78 Z"
          fill="currentColor"
        />
      );
    case 'sun-waves':
      return (
        <>
          <circle cx="76" cy="26" r="14" fill="currentColor" />
          <path
            d="M0 60c10-8 20-8 30 0s20 8 30 0 20-8 30 0 20 8 30 0"
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
          />
          <path
            d="M0 78c10-8 20-8 30 0s20 8 30 0 20-8 30 0 20 8 30 0"
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
            opacity="0.6"
          />
        </>
      );
    case 'starburst':
      return (
        <g stroke="currentColor" strokeWidth="2.5">
          <circle cx="50" cy="46" r="20" fill="none" opacity="0.7" />
          <path d="M50 8v20M50 64v20M12 46h20M68 46h20" />
          <path d="M22 18l14 14M64 60l14 14M78 18L64 32M36 60L22 74" />
        </g>
      );
    case 'arch':
      return (
        <path
          d="M18 90V52a32 32 0 0 1 64 0v38"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
        />
      );
    case 'compass':
    default:
      return (
        <g stroke="currentColor" strokeWidth="1.5" fill="none">
          <circle cx="50" cy="50" r="46" />
          <circle cx="50" cy="50" r="32" />
          <path d="M50 8v18M50 74v18M8 50h18M74 50h18" />
          <path
            d="M50 24 60 50 50 76 40 50Z"
            fill="currentColor"
            stroke="none"
          />
        </g>
      );
  }
}

Motif.propTypes = { name: PropTypes.oneOf(MOTIFS).isRequired };

/** A numeric id seeds directly; any other value (a title string, when no id is available) is hashed so it still varies instead of collapsing to one shared mesh. */
function seedToIndex(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    return Math.abs(Math.trunc(seed));
  }
  const text = String(seed ?? '');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    // Modulo-bounded rather than a bitwise `| 0` wraparound (disallowed,
    // `no-bitwise`) — keeps `hash` a safe, non-negative integer through
    // every iteration without needing one.
    hash = (hash * 31 + text.charCodeAt(i)) % 2_147_483_647;
  }
  return Math.abs(hash);
}

export default function DestinationArt({ seed, className = undefined }) {
  const index = seedToIndex(seed);
  const combinedClassName = [
    styles.art,
    styles[`art--mesh-${(index % 5) + 1}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const motif = MOTIFS[index % MOTIFS.length];

  return (
    <div className={combinedClassName} aria-hidden="true">
      <svg
        className={styles.motif}
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        focusable="false"
      >
        <Motif name={motif} />
      </svg>
    </div>
  );
}

DestinationArt.propTypes = {
  seed: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  className: PropTypes.string,
};

// Exported so other procedural-art surfaces (e.g. `CompanyAvatar`'s
// initials-avatar mesh) can key off the exact same deterministic mesh
// index this component uses, instead of re-deriving their own hash.
export { seedToIndex };
