/**
 * Pagination — COMPONENT_LIBRARY.md Part II §3 "Pagination". Page-based
 * navigation for the small set of dashboard contexts that use classic
 * paging rather than infinite scroll/cursor pagination — every list
 * page in this codebase currently uses cursor pagination instead
 * (`useAdminUsersQuery.js`'s own header note), so this has no live
 * consumer yet.
 */

import PropTypes from 'prop-types';
import styles from './Pagination.module.scss';

function buildPageRange(currentPage, totalPages, siblingCount) {
  const start = Math.max(1, currentPage - siblingCount);
  const end = Math.min(totalPages, currentPage + siblingCount);
  const pages = [];
  for (let page = start; page <= end; page += 1) pages.push(page);
  return pages;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  siblingCount = 1,
  ariaLabel = 'Pagination',
  previousLabel = 'Previous',
  nextLabel = 'Next',
  getPageLabel = (page) => `Go to page ${page}`,
}) {
  if (totalPages <= 1) return null;

  const pages = buildPageRange(currentPage, totalPages, siblingCount);

  return (
    <nav aria-label={ariaLabel} className={styles.pagination}>
      <button
        type="button"
        className={styles.navButton}
        disabled={currentPage <= 1}
        aria-label={previousLabel}
        onClick={() => onPageChange(currentPage - 1)}
      >
        {previousLabel}
      </button>

      <span className={styles.pages}>
        {pages[0] > 1 && (
          <>
            <button
              type="button"
              className={styles.pageButton}
              aria-label={getPageLabel(1)}
              onClick={() => onPageChange(1)}
            >
              1
            </button>
            {pages[0] > 2 && <span className={styles.ellipsis}>…</span>}
          </>
        )}
        {pages.map((page) => (
          <button
            key={page}
            type="button"
            className={[
              styles.pageButton,
              page === currentPage && styles['pageButton--current'],
            ]
              .filter(Boolean)
              .join(' ')}
            aria-current={page === currentPage ? 'page' : undefined}
            aria-label={getPageLabel(page)}
            onClick={() => onPageChange(page)}
          >
            {page}
          </button>
        ))}
        {pages[pages.length - 1] < totalPages && (
          <>
            {pages[pages.length - 1] < totalPages - 1 && (
              <span className={styles.ellipsis}>…</span>
            )}
            <button
              type="button"
              className={styles.pageButton}
              aria-label={getPageLabel(totalPages)}
              onClick={() => onPageChange(totalPages)}
            >
              {totalPages}
            </button>
          </>
        )}
      </span>

      <button
        type="button"
        className={styles.navButton}
        disabled={currentPage >= totalPages}
        aria-label={nextLabel}
        onClick={() => onPageChange(currentPage + 1)}
      >
        {nextLabel}
      </button>
    </nav>
  );
}

Pagination.propTypes = {
  currentPage: PropTypes.number.isRequired,
  totalPages: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired,
  siblingCount: PropTypes.number,
  ariaLabel: PropTypes.string,
  previousLabel: PropTypes.string,
  nextLabel: PropTypes.string,
  getPageLabel: PropTypes.func,
};
