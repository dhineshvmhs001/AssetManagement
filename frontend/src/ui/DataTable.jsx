import { useMemo, useState } from 'react';
import Button from './Button';
import EmptyState from './EmptyState';
import Skeleton from './Skeleton';
import './DataTable.css';

function compare(a, b) {
  // Nulls sort last in both directions — a column of blanks at the top is
  // never the answer anyone was looking for.
  const aEmpty = a === null || a === undefined || a === '';
  const bEmpty = b === null || b === undefined || b === '';
  if (aEmpty || bEmpty) {
    return aEmpty && bEmpty ? 0 : aEmpty ? 1 : -1;
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

function SkeletonRows({ columns, rows, selectable }) {
  return Array.from({ length: rows }, (_, r) => (
    <tr key={r} className="ds-table__row">
      {selectable ? (
        <td className="ds-table__check">
          <Skeleton width={14} height={14} radius={4} />
        </td>
      ) : null}
      {columns.map((col) => (
        <td key={col.key}>
          <Skeleton width={`${55 + ((r * 7 + col.key.length * 5) % 40)}%`} />
        </td>
      ))}
    </tr>
  ));
}

/**
 * The workhorse list.
 *
 * Sorting and paging are internal by default. Pass `page`/`onPageChange` (with
 * `total`) or `sort`/`onSortChange` to drive either from the server instead —
 * this app's lists are paged and sorted in SQL.
 */
export default function DataTable({
  columns,
  rows = [],
  rowKey = (row, i) => row.id ?? i,
  onRowClick,
  activeKey,
  empty,
  selectable = false,
  selected = [],
  onSelect,
  bulkActions,
  pageSize = 10,
  alwaysShowPager = false,
  loading = false,
  // Server-driven mode
  page: pageProp,
  onPageChange,
  total: totalProp,
  sort: sortProp,
  onSortChange,
  countLabel,
}) {
  const [internalSort, setInternalSort] = useState(null);
  const [internalPage, setInternalPage] = useState(1);

  const serverSorted = Boolean(onSortChange);
  const serverPaged = Boolean(onPageChange);
  const sort = serverSorted ? sortProp : internalSort;

  const sortedRows = useMemo(() => {
    if (serverSorted || !sort?.key) {
      return rows;
    }
    const column = columns.find((c) => c.key === sort.key);
    const read = column?.sortValue || ((row) => row[sort.key]);
    const dir = sort.dir === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => {
      const result = compare(read(a), read(b));
      // Empties stay last whichever way the column is pointing, so the
      // direction flip does not drag them to the top.
      return result === 0 ? 0 : dir * result;
    });
  }, [rows, sort, columns, serverSorted]);

  const total = serverPaged ? (totalProp ?? rows.length) : sortedRows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const requested = serverPaged ? pageProp || 1 : internalPage;

  // Clamped here, in render — not in an effect. A filter that shrinks the list
  // leaves the page index past the end; slicing with the stale value returns
  // nothing and a table with rows in it reads as empty. Doing it in an effect
  // lets the rows and the pager disagree for a frame.
  const page = Math.min(Math.max(1, requested), pageCount);

  const visible = serverPaged
    ? sortedRows
    : sortedRows.slice((page - 1) * pageSize, page * pageSize);

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = serverPaged ? Math.min(from + visible.length - 1, total) : Math.min(page * pageSize, total);

  function goTo(next) {
    const clamped = Math.min(Math.max(1, next), pageCount);
    if (serverPaged) {
      onPageChange(clamped);
    } else {
      setInternalPage(clamped);
    }
  }

  function toggleSort(key) {
    const dir = sort?.key === key && sort.dir === 'asc' ? 'desc' : 'asc';
    if (serverSorted) {
      onSortChange({ key, dir });
    } else {
      setInternalSort({ key, dir });
      setInternalPage(1);
    }
  }

  const selectedKeys = new Set(selected.map(String));
  const visibleKeys = visible.map((row, i) => String(rowKey(row, i)));
  const allSelected = visibleKeys.length > 0 && visibleKeys.every((k) => selectedKeys.has(k));

  function toggleAll() {
    if (!onSelect) {
      return;
    }
    onSelect(allSelected ? [] : visibleKeys);
  }

  function toggleOne(key) {
    if (!onSelect) {
      return;
    }
    const next = new Set(selectedKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onSelect([...next]);
  }

  const showPager = alwaysShowPager || pageCount > 1;
  const colSpan = columns.length + (selectable ? 1 : 0);

  return (
    <div className="ds-table-wrap">
      {selectable && selected.length > 0 ? (
        <div className="ds-table__bulk">
          <span>{selected.length} selected</span>
          {bulkActions}
        </div>
      ) : null}

      <div className="ds-table-scroll">
        <table className="ds-table">
          <thead>
            <tr className="ds-table__headrow">
              {selectable ? (
                <th className="ds-table__check">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all rows on this page"
                  />
                </th>
              ) : null}
              {columns.map((col) => {
                const isSorted = sort?.key === col.key;
                return (
                  <th
                    key={col.key}
                    style={col.width ? { width: col.width } : undefined}
                    aria-sort={
                      isSorted ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
                    }
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        className="ds-table__sort"
                        onClick={() => toggleSort(col.key)}
                      >
                        {col.label}
                        <span className="ds-table__sort-mark" aria-hidden="true">
                          {isSorted ? (sort.dir === 'asc' ? '▲' : '▼') : ''}
                        </span>
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* Skeletons while loading, never the empty state — a list that
                flashes "nothing found" before its rows arrive costs a
                double-take every single time. */}
            {loading ? (
              <SkeletonRows columns={columns} rows={Math.min(pageSize, 6)} selectable={selectable} />
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="ds-table__empty-cell">
                  {empty || <EmptyState title="Nothing to show" sub="No rows match these filters." />}
                </td>
              </tr>
            ) : (
              visible.map((row, index) => {
                const key = String(rowKey(row, index));
                return (
                  <tr
                    key={key}
                    className={[
                      'ds-table__row',
                      onRowClick ? 'ds-table__row--clickable' : '',
                      activeKey !== undefined && String(activeKey) === key ? 'is-active' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                  >
                    {selectable ? (
                      <td className="ds-table__check" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedKeys.has(key)}
                          onChange={() => toggleOne(key)}
                          aria-label={`Select row ${key}`}
                        />
                      </td>
                    ) : null}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={[
                          col.align ? `ds-table__cell--${col.align}` : '',
                          col.mono ? 'ds-table__cell--mono' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {col.render ? col.render(row, index) : formatCell(row[col.key])}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showPager || countLabel ? (
        <div className="ds-table__foot">
          <p className="ds-table__count">
            {total ? `${from}–${to} of ${total}${countLabel ? ` ${countLabel}` : ''}` : `0 ${countLabel || ''}`.trim()}
          </p>
          {showPager ? (
            <div className="ds-pager">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => goTo(page - 1)}>
                Previous
              </Button>
              <span className="ds-pager__pos">
                Page {page} of {pageCount}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= pageCount}
                onClick={() => goTo(page + 1)}
              >
                Next
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// A field that was never recorded renders as an em dash. Never a stand-in
// value — a blank filled from present-day state files an old row under a fact
// that was never true of it.
function formatCell(value) {
  if (value === null || value === undefined || value === '') {
    return <span className="ds-empty-value">—</span>;
  }
  return value;
}
