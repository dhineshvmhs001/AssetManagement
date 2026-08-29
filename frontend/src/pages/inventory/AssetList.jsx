import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { listAssets, exportAssets } from '../../api/assets.api';
import { isTypingTarget } from '../../keyboard/keys';
import { useKeyboard } from '../../keyboard/KeyboardProvider';
import { notify } from '../../ui/notify';
import {
  Button,
  DataTable,
  EmptyState,
  Field,
  Input,
  PageHeader,
  FilterRow,
  Select,
  StatusPill,
  statusLabel,
} from '../../ui';

const EMPTY = { search: '', category: '', status: '', location: '' };
const PAGE_SIZE = 20;

const EMPTY_DATA = {
  assets: [],
  total: 0,
  page: 1,
  pages: 1,
  counts: { total: 0, byStatus: {} },
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
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(0);
  const [exporting, setExporting] = useState(false);

  const params = { ...filters, page, limit: PAGE_SIZE, sort: sort.key, dir: sort.dir };

  useEffect(() => {
    let live = true;
    setLoading(true);
    listAssets(params).then((res) => {
      if (!live) {
        return;
      }
      if (res.ok) {
        setData(res);
        setSelected(0);
      }
      setLoading(false);
    });
    return () => {
      live = false;
    };
    // Depends on the individual values, not on `params` — that object is
    // rebuilt every render and would refetch in a loop.
  }, [filters.search, filters.category, filters.status, filters.location, page, sort.key, sort.dir]);

  useEffect(() => {
    document.querySelector('.ds-table__row.is-active')?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  useEffect(() => {
    function onKey(e) {
      if (kbd?.helpOpen || isTypingTarget(e.target) || !data.assets.length) {
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

  function clearFilters() {
    setFilters(EMPTY);
    setPage(1);
  }

  async function handleExport() {
    setExporting(true);
    const url = await exportAssets(params);
    setExporting(false);
    if (!url) {
      notify.error('Could not export', 'The filtered set was not returned. Nothing was downloaded.');
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = 'assets_export.csv';
    a.click();
    URL.revokeObjectURL(url);
    notify.success('Export downloaded ✓', 'assets_export.csv — the current filters, all pages.');
  }

  // Counts come from the API, which computes them with the status filter left
  // out. Showing them in the options means an empty result reads as a real
  // answer rather than a broken filter. Categories have no counts on the
  // endpoint, so they get none here — a plausible number is worse than none.
  const byStatus = data.counts?.byStatus || {};
  const filtered = Object.values(filters).some(Boolean);

  const COLUMNS = [
    {
      key: 'assetCode',
      label: 'Asset',
      sortable: true,
      render: (row) => (
        <Link className="inv-asset-cell" to={`/inventory/${row.assetCode}`} onClick={(e) => e.stopPropagation()}>
          <strong className="ds-mono">{row.assetCode}</strong>
          <span className="ds-mono ds-muted">{row.serialNumber || '—'}</span>
        </Link>
      ),
    },
    { key: 'category', label: 'Category', sortable: true },
    { key: 'brand', label: 'Brand', sortable: true },
    { key: 'model', label: 'Model', sortable: true },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => <StatusPill status={row.status} label={row.statusLabel} />,
    },
    { key: 'employeeName', label: 'Employee', sortable: true },
    { key: 'location', label: 'Location', sortable: true },
  ];

  return (
    <section>
      <PageHeader
        title="Asset list"
        sub="Up/down selects a row, Enter opens it. Left/right switches Inventory tabs."
        right={
          <>
            <Button variant="ghost" loading={exporting} onClick={handleExport}>
              {exporting ? 'Exporting…' : 'Export CSV'}
            </Button>
            <Button variant="secondary" as={Link} to="/inventory/import">
              Bulk import
            </Button>
            <Button variant="primary" as={Link} to="/inventory/add">
              Add asset
            </Button>
          </>
        }
      />

      <FilterRow>
        <Field label="Search" style={{ flex: '1 1 240px' }} htmlFor="inv-list-search">
          <Input
            id="inv-list-search"
            placeholder="Asset code, serial, brand…"
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
          />
        </Field>

        <Field label="Category" style={{ flex: '0 1 190px' }}>
          <Select
            value={filters.category}
            onChange={(e) => set('category', e.target.value)}
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {(data.filters?.categories || []).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Status" style={{ flex: '0 1 220px' }}>
          <Select
            value={filters.status}
            onChange={(e) => set('status', e.target.value)}
            aria-label="Filter by status"
          >
            <option value="" count={data.counts?.total ?? 0}>
              All statuses
            </option>
            {(data.filters?.statuses || []).map((item) => (
              <option key={item} value={item} count={byStatus[item] ?? 0}>
                {statusLabel(item)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Location" style={{ flex: '0 1 190px' }}>
          <Input
            placeholder="Any location"
            value={filters.location}
            onChange={(e) => set('location', e.target.value)}
          />
        </Field>

        {filtered ? (
          <Button variant="ghost" size="sm" onClick={clearFilters} style={{ marginBottom: 1 }}>
            Clear
          </Button>
        ) : null}
      </FilterRow>

      <DataTable
        columns={COLUMNS}
        rows={data.assets}
        rowKey={(row) => row.id}
        activeKey={data.assets[selected]?.id}
        onRowClick={(row) => navigate(`/inventory/${row.assetCode}`)}
        loading={loading}
        pageSize={PAGE_SIZE}
        alwaysShowPager
        countLabel="assets"
        page={page}
        onPageChange={setPage}
        total={data.total}
        sort={sort}
        onSortChange={(next) => {
          setSort(next);
          setPage(1);
        }}
        empty={
          filtered ? (
            <EmptyState
              icon="⌕"
              title="No assets match these filters"
              sub="The counts beside each status show what is there. Clear the filters to see everything."
              actions={
                <Button variant="soft" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon="▤"
              title="No assets yet"
              sub="Add one, or bring the existing inventory in from a spreadsheet."
              actions={
                <>
                  <Button variant="secondary" size="sm" as={Link} to="/inventory/import">
                    Bulk import
                  </Button>
                  <Button variant="primary" size="sm" as={Link} to="/inventory/add">
                    Add asset
                  </Button>
                </>
              }
            />
          )
        }
      />
    </section>
  );
}
