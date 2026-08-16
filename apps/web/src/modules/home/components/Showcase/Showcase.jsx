/**
 * Showcase — the shared "premium showcase carousel" engine every
 * showcase section builds on (FeaturedDestinations/FeaturedListings/
 * PopularExperiences/Testimonials), instead of each section wiring Embla
 * independently. Embla (embla-carousel-react) owns scroll/drag/wheel
 * physics only — the center-focus scale/opacity emphasis, navigation
 * chrome, and drag-vs-click safety here are custom on top of it, per the
 * brief's "not a generic carousel component" requirement.
 *
 * Slide *sizing* (how wide each card is per breakpoint) is deliberately
 * left to the caller via `slideClassName` — Showcase stays
 * content-agnostic (engine + chrome only), the same `className`-in
 * composition pattern `ScrollReveal` already uses.
 */

import { Children, useEffect, useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import useReducedMotion from '../../../../hooks/useReducedMotion.js';
import styles from './Showcase.module.scss';

const AUTOPLAY_DELAY_MS = 4500;
const CLICK_DRAG_THRESHOLD_PX = 8;
// Scale carries most of the "center card in focus" read — a wide
// falloff so the active card is unmistakably the dominant element, not
// just marginally bigger than its neighbors; opacity recedes side cards
// enough to read as clearly secondary while staying identifiable (the
// brief's "side-card visibility").
const SCALE_FALLOFF = 0.32;
const OPACITY_FALLOFF = 0.45;

export default function Showcase({
  children,
  loop = true,
  autoplay = true,
  ariaLabel = undefined,
  slideClassName = undefined,
}) {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const slideCount = Children.count(children);

  // Plugins are only ever constructed once per mount — recreating the
  // array on every render would make Embla think its plugin set changed.
  const pluginsRef = useRef(
    [
      WheelGesturesPlugin(),
      autoplay && !prefersReducedMotion
        ? Autoplay({
            delay: AUTOPLAY_DELAY_MS,
            stopOnInteraction: false,
            stopOnMouseEnter: true,
          })
        : null,
    ].filter(Boolean),
  );

  const [emblaRef, emblaApi] = useEmblaCarousel(
    // A longer scroll duration than Embla's default (25) reads as a
    // deliberate, elegant glide between slides rather than a snap.
    { loop, align: 'center', containScroll: false, duration: 32 },
    pluginsRef.current,
  );

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState([]);

  // Embla's loop engine only repositions a "wrapped" slide (e.g. the
  // last slide, moved to sit just before the first) in response to an
  // actual scroll — at initial mount, before any scroll has ever
  // happened, nothing has been moved into place yet, leaving a real
  // empty gap where the peeking neighbor should be on first paint. A
  // same-tick, non-animated nudge forward and back forces that
  // reposition on both sides before the browser paints, so the loop
  // looks correct from the very first frame instead of only after the
  // first manual interaction or autoplay tick.
  useLayoutEffect(() => {
    if (!emblaApi || !loop) return;
    if (emblaApi.scrollSnapList().length <= 1) return;
    // scrollPrev/scrollNext (not scrollTo) are what actually drive
    // Embla's loop-point reposition logic — verified empirically: a
    // manual scrollTo(index, true) round-trip left the wrap slide
    // exactly where it started, while a real scrollPrev() call
    // correctly moved it into place.
    emblaApi.scrollPrev(true);
    emblaApi.scrollNext(true);
  }, [emblaApi, loop]);

  // Center-focus scale/opacity emphasis: measured with Embla's public
  // `rootNode()`/`slideNodes()` (not `internalEngine()` internals, which
  // aren't part of the stable API) — plain "distance from viewport
  // center" geometry, batched to one measurement/write pass per frame.
  useEffect(() => {
    if (!emblaApi || prefersReducedMotion) return undefined;
    let rafId = null;

    function applyEmphasis() {
      rafId = null;
      const viewportRect = emblaApi.rootNode().getBoundingClientRect();
      const viewportCenter = viewportRect.left + viewportRect.width / 2;

      emblaApi.slideNodes().forEach((slideNode) => {
        // Measured from the outer slide node (Embla's own box, stable
        // regardless of the inner wrapper's transform) but *applied* to
        // the inner wrapper — see the JSX comment above.
        const inner = slideNode.querySelector('[data-showcase-inner]');
        if (!inner) return;
        const slideRect = slideNode.getBoundingClientRect();
        const slideCenter = slideRect.left + slideRect.width / 2;
        const maxDistance = viewportRect.width / 2 + slideRect.width / 2;
        const t2 = Math.min(
          Math.abs(viewportCenter - slideCenter) / maxDistance,
          1,
        );
        inner.style.transform = `scale(${(1 - t2 * SCALE_FALLOFF).toFixed(3)})`;
        inner.style.opacity = (1 - t2 * OPACITY_FALLOFF).toFixed(3);
      });
    }

    function scheduleEmphasis() {
      if (rafId === null) rafId = requestAnimationFrame(applyEmphasis);
    }

    scheduleEmphasis();
    emblaApi.on('scroll', scheduleEmphasis);
    emblaApi.on('reInit', scheduleEmphasis);
    emblaApi.on('resize', scheduleEmphasis);
    // 'select' too: a jump-mode scrollPrev/scrollNext (the initial
    // loop-position nudge above, or autoplay's own jump-free advances)
    // changes the active slide without necessarily firing 'scroll' —
    // without this, the emphasis transform can go stale after such a
    // move, leaving every slide at full scale/opacity.
    emblaApi.on('select', scheduleEmphasis);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      emblaApi.off('scroll', scheduleEmphasis);
      emblaApi.off('reInit', scheduleEmphasis);
      emblaApi.off('resize', scheduleEmphasis);
      emblaApi.off('select', scheduleEmphasis);
    };
  }, [emblaApi, prefersReducedMotion]);

  // Dot pagination state.
  useEffect(() => {
    if (!emblaApi) return undefined;

    function onInit() {
      setScrollSnaps(emblaApi.scrollSnapList());
    }
    function onSelect() {
      setSelectedIndex(emblaApi.selectedScrollSnap());
    }

    onInit();
    onSelect();
    emblaApi.on('reInit', onInit);
    emblaApi.on('reInit', onSelect);
    emblaApi.on('select', onSelect);

    return () => {
      emblaApi.off('reInit', onInit);
      emblaApi.off('reInit', onSelect);
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi]);

  // Drag-vs-click safety: a drag gesture that ends on top of a card
  // (every card here is a full RouterLink) must not also fire that
  // link's click — a known Embla FAQ item, not specific to this app.
  useEffect(() => {
    if (!emblaApi) return undefined;
    const container = emblaApi.containerNode();
    let pointerDownAt = null;

    function handlePointerDown(event) {
      pointerDownAt = { x: event.clientX, y: event.clientY };
    }

    function handlePointerUp(event) {
      if (!pointerDownAt) return;
      const dx = Math.abs(event.clientX - pointerDownAt.x);
      const dy = Math.abs(event.clientY - pointerDownAt.y);
      pointerDownAt = null;
      if (dx <= CLICK_DRAG_THRESHOLD_PX && dy <= CLICK_DRAG_THRESHOLD_PX)
        return;

      function suppressNextClick(clickEvent) {
        clickEvent.preventDefault();
        clickEvent.stopPropagation();
        container.removeEventListener('click', suppressNextClick, true);
      }
      container.addEventListener('click', suppressNextClick, true);
    }

    container.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('pointerup', handlePointerUp);
    return () => {
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('pointerup', handlePointerUp);
    };
  }, [emblaApi]);

  return (
    <div className={styles.showcase}>
      <div
        className={styles.viewport}
        ref={emblaRef}
        role="group"
        aria-roledescription="carousel"
        aria-label={ariaLabel}
      >
        <div className={styles.container}>
          {Children.map(children, (child, index) => (
            <div
              key={child?.key ?? index}
              className={[styles.slide, slideClassName]
                .filter(Boolean)
                .join(' ')}
              aria-roledescription="slide"
              aria-label={`${index + 1}/${slideCount}`}
            >
              {/* The center-focus scale/opacity emphasis is applied to
                  this inner wrapper, never the outer slide node above —
                  Embla writes its own translate3d directly to each
                  slide node's `style.transform` (for loop repositioning
                  and, once any scroll has occurred, ordinary position
                  too), which would otherwise race with and overwrite a
                  scale set on the same element. */}
              <div className={styles.slideInner} data-showcase-inner="">
                {child}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        className={[styles.navButton, styles['navButton--prev']].join(' ')}
        aria-label={t('home.showcase.previous')}
        onClick={() => emblaApi?.scrollPrev()}
      >
        <ChevronLeft size={24} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={[styles.navButton, styles['navButton--next']].join(' ')}
        aria-label={t('home.showcase.next')}
        onClick={() => emblaApi?.scrollNext()}
      >
        <ChevronRight size={24} aria-hidden="true" />
      </button>

      {scrollSnaps.length > 1 && (
        <div className={styles.dots}>
          {scrollSnaps.map((_, index) => (
            <button
              // Dots are positionally static, one per scroll snap, non-reorderable.
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              type="button"
              className={[
                styles.dot,
                index === selectedIndex && styles['dot--active'],
              ]
                .filter(Boolean)
                .join(' ')}
              aria-label={t('home.showcase.goToSlide', { index: index + 1 })}
              aria-current={index === selectedIndex}
              onClick={() => emblaApi?.scrollTo(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

Showcase.propTypes = {
  children: PropTypes.node.isRequired,
  loop: PropTypes.bool,
  autoplay: PropTypes.bool,
  ariaLabel: PropTypes.string,
  slideClassName: PropTypes.string,
};
