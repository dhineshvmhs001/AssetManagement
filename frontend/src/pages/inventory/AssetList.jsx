import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { listAssets, exportAssets } from '../../api/assets.api';
import { isTypingTarget } from '../../keyboard/keys';
import { useKeyboard } from '../../keyboard/KeyboardProvider';
import { notify } from '../../ui/notify';

const EMPTY = { search: '', category: '', status: '', location: '' };
const PAGE_SIZE = 20;

const COLUMNS = [
  { key: 'assetCode', label: 'Asset ID' },
  { key: 'category', label: 'Category' },
  { key: 'brand', label: 'Brand' },
  { key: 'model', label: 'Model' },
  { key: 'serialNumber', label: 'Serial No' },
  { key: 'status', label: 'Status' },
  { key: 'employeeName', label: 'Employee' },
  { key: 'location', label: 'Location' },
];

const EMPTY_DATA = {
  assets: [],
  total: 0,
  page: 1,
  pages: 1,
  filters: { categories: [], statuses: [] },
};

export default function AssetList() {
  const navigate = useNavigate();
  const kbd = useKeyboard();
  // The dashboard tiles link here as /inventory?status=DAMAGED, so the status
  // filter starts from the URL when one is present.
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    ...EMPTY,
    status: searchParams.get('status') || '',
  });
  const [sort, setSort] = useState({ key: 'createdAt', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(EMPTY_DATA);
  const [selected, setSelected] = useState(0);
  const [exporting, setExporting] = useState(false);

  const params = { ...filters, page, limit: PAGE_SIZE, sort: sort.key, dir: sort.dir };

  useEffect(() => {
    listAssets(params).then((res) => {
      if (res.ok) {
        setData(res);
        setSelected(0);
      }
    });
    // Depends on the individual values, not on `params` — that object is
    // rebuilt every render and would refetch in a loop.
  }, [filters.search, filters.category, filters.status, filters.location, page, sort.key, sort.dir]);

  useEffect(() => {
    document.querySelector('.inv-table tr.is-selected')?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  useEffect(() => {
    function onKey(e) {
      if (kbd?.helpOpen) {
        return;
      }
      if (isTypingTarget(e.target)) {
        return;
      }
      if (!data.assets.length) {
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected((i) => Math.min(data.assets.length - 1, i + 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected((i) => Math.max(0, i - 1));
      }
      if (e.key === 'Enter') {
        const asset = data.assets[selected];
        if (asset) {
          e.preventDefault();
          navigate(`/inventory/${asset.assetCode}`);
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [data.assets, kbd?.helpOpen, navigate, selected]);

  // Any filter change invalidates the current page number — page 4 of the old
  // result set is usually past the end of the new one.
  function set(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  function toggleSort(key) {
    setSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc',
    }));
    setPage(1);
  }

  async function handleExport() {
    setExporting(true);
    const url = await exportAssets(params);
    setExporting(false);
    if (!url) {
      notify.error('Could not export');
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = 'assets_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const pages = data.pages || 1;
  const from = data.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, data.total);

  return (
    <section>
      <div className="inv-head">
        <div>
          <h2>Asset list</h2>
          <p>Search, filter, then open an asset. Up/down selects a row, Enter opens it. Left/right switches Inventory tabs.</p>
        </div>
        <div className="inv-actions">
          <button type="button" className="btn ghost" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          <Link className="btn ghost" to="/inventory/import" tabIndex={-1}>
            Bulk import
          </Link>
          <Link className="btn primary" to="/inventory/add" tabIndex={-1}>
            Add asset
          </Link>
        </div>
      </div>

      <div className="inv-toolbar">
        <input
          id="inv-list-search"
          className="inv-search"
          placeholder="Search asset code, serial, brand…"
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
        />
        <select value={filters.category} onChange={(e) => set('category', e.target.value)}>
          <option value="">All categories</option>
          {(data.filters?.categories || []).map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select value={filters.status} onChange={(e) => set('status', e.target.value)}>
          <option value="">All statuses</option>
          {(data.filters?.statuses || []).map((item) => (
            <option key={item} value={item}>
              {item.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
        <input
          className="inv-search"
          placeholder="Location"
          value={filters.location}
          onChange={(e) => set('location', e.target.value)}
        />
      </div>

      <div className="inv-table-wrap">
        <table className="inv-table">
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`inv-sortable${sort.key === col.key ? ` sorted-${sort.dir}` : ''}`}
                  aria-sort={sort.key === col.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  onClick={() => toggleSort(col.key)}
                >
                  {col.label}
                  <span className="inv-sort-mark">{sort.key === col.key ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.assets.map((asset, index) => (
              <tr
                key={asset.id}
                className={index === selected ? 'is-selected' : undefined}
                onClick={() => setSelected(index)}
                onDoubleClick={() => navigate(`/inventory/${asset.assetCode}`)}
              >
                <td>
                  <Link to={`/inventory/${asset.assetCode}`} tabIndex={-1}>
                    {asset.assetCode}
                  </Link>
                </td>
                <td>{asset.category}</td>
                <td>{asset.brand}</td>
                <td>{asset.model || '—'}</td>
                <td>{asset.serialNumber}</td>
                <td>
                  <span className={`st st-${asset.status.toLowerCase()}`}>{asset.statusLabel}</span>
                </td>
                <td>{asset.employeeName || '—'}</td>
                <td>{asset.location || '—'}</td>
              </tr>
            ))}
            {!data.assets.length && (
              <tr>
                <td colSpan={COLUMNS.length} className="inv-empty">
                  No assets yet. Add one or bulk import.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="inv-pager">
        <p className="inv-count">
          {data.total ? `${from}–${to} of ${data.total} assets` : '0 assets'}
        </p>
        <div className="inv-pager-btns">
          <button type="button" className="btn ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </button>
          <span className="inv-muted">
            Page {page} of {pages}
          </span>
          <button type="button" className="btn ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
