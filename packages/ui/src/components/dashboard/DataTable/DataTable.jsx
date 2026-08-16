/**
 * DataTable — COMPONENT_LIBRARY.md Part II §5 "Table", the first generic
 * table/list-with-columns primitive in this package (every prior list
 * page hand-rolled its own card grid) — a real `<table>` for correct
 * screen-reader semantics, columns config + optional per-column
 * `render`, and a "Load more" footer matching this app's established
 * cursor-pagination convention (`useAdminUsersQuery.js`'s own note)
 * rather than the unused `Pagination` primitive.
 */

import PropTypes from 'prop-types';
import Button from '../../primitives/Button/Button.jsx';
import Skeleton from '../../feedback-overlays/Skeleton/Skeleton.jsx';
import EmptyState from '../../feedback-overlays/EmptyState/EmptyState.jsx';
import styles from './DataTable.module.scss';

const SKELETON_ROW_COUNT = 5;

export default function DataTable({
  columns,
  rows,
  isLoading = false,
  emptyTitle,
  emptyDescription = undefined,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore = undefined,
  loadMoreLabel = undefined,
  onRowClick = undefined,
}) {
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={
                  column.align ? styles[`align-${column.align}`] : undefined
                }
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading &&
            Array.from({ length: SKELETON_ROW_COUNT }, (_, rowIndex) => (
              // eslint-disable-next-line react/no-array-index-key -- fixed-count skeleton placeholder rows, no real identity
              <tr key={rowIndex}>
                {columns.map((column) => (
                  <td key={column.key}>
                    <Skeleton variant="text" />
                  </td>
                ))}
              </tr>
            ))}
          {!isLoading &&
            rows.map((row) => (
              <tr
                key={row.id}
                className={onRowClick ? styles.clickableRow : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={
                      column.align ? styles[`align-${column.align}`] : undefined
                    }
                  >
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>

      {!isLoading && rows.length === 0 && (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      )}

      {!isLoading && hasMore && onLoadMore && (
        <div className={styles.loadMore}>
          <Button
            variant="secondary"
            onClick={onLoadMore}
            loading={isLoadingMore}
          >
            {loadMoreLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

const columnShape = PropTypes.shape({
  key: PropTypes.string.isRequired,
  header: PropTypes.node.isRequired,
  align: PropTypes.oneOf(['left', 'center', 'right']),
  render: PropTypes.func,
});

DataTable.propTypes = {
  columns: PropTypes.arrayOf(columnShape).isRequired,
  // eslint-disable-next-line react/forbid-prop-types -- row shape is entirely caller-defined, keyed only by `columns[].key`/`.render`
  rows: PropTypes.arrayOf(PropTypes.object).isRequired,
  isLoading: PropTypes.bool,
  emptyTitle: PropTypes.string.isRequired,
  emptyDescription: PropTypes.string,
  hasMore: PropTypes.bool,
  isLoadingMore: PropTypes.bool,
  onLoadMore: PropTypes.func,
  loadMoreLabel: PropTypes.string,
  onRowClick: PropTypes.func,
};
