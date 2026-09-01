import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { exportReport, getReportCatalog, runReport } from '../../api/reports.api';
import { useAuth } from '../../auth/AuthProvider';
import { canAccessPath } from '../../auth/access';
import { notify } from '../../ui/notify';
import {
  Button,
  DataTable,
  DateRangePicker,
  defaultRange,
  EmptyState,
  Field,
  FilterRow,
  formatDate,
  formatDateTime,
  istDay,
  monthsBack,
  PageHeader,
  Pill,
  Select,
  StatusPill,
} from '../../ui';

const PAGE_SIZE = 20;
const DATE_KEYS = new Set([
  'at',
  'assignedAt',
  'returnedAt',
  'createdAt',
  'completedAt',
  'expectedReturn',
  'acknowledgedAt',
]);

function emptyFilters() {
  return { category: '', department: '', status: '', ...defaultRange() };
}

function defaultSortFor(spec) {
  return spec?.defaultSort || { key: 'assetCode', dir: 'asc' };
}

function renderCell(col, row) {
  const value = row[col.key];
  if (col.key === 'assetCode' && row.assetCode) {
    return row._assetLink ? (
      <Link className="ds-mono" to={`/inventory/${row.assetCode}`} onClick={(e) => e.stopPropagation()}>
        {row.assetCode}
      </Link>
    ) : (
      <span className="ds-mono">{row.assetCode}</span>
    );
  }
  if (col.key === 'ticketCode' && row.ticketCode) {
    return row._ticketLink ? (
      <Link to={`/tickets/${row.ticketCode}`} onClick={(e) => e.stopPropagation()}>
        {row.ticketCode}
      </Link>
    ) : (
      row.ticketCode
    );
  }
  if (col.key === 'status') {
    return <StatusPill status={row.status} label={row.statusLabel} />;
  }
  if (col.key === 'action' || col.key === 'kind' || col.key === 'holding') {
    return value ? <Pill tone="neutral">{row.actionLabel || value}</Pill> : <span className="ds-empty-value">—</span>;
  }
  if (DATE_KEYS.has(col.key)) {
    if (!value) {
      return <span className="ds-empty-value">—</span>;
    }
    return col.key === 'assignedAt' ||
      col.key === 'returnedAt' ||
      col.key === 'expectedReturn' ||
      col.key === 'acknowledgedAt'
      ? formatDate(value)
      : formatDateTime(value);
  }
  if (col.key === 'share') {
    return `${value}%`;
  }
  if (value == null || value === '') {
    return <span className="ds-empty-value">—</span>;
  }
  return value;
}

export default function Reports() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [catalog, setCatalog] = useState({ groups: [], filters: {} });
  const [group, setGroup] = useState('asset');
  const [slug, setSlug] = useState('total');
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: 'assetCode', dir: 'asc' });
  const [data, setData] = useState({
    rows: [],
    columns: [
      { key: 'assetCode', label: 'Asset', sortable: true },
      { key: 'category', label: 'Category', sortable: true },
      { key: 'brand', label: 'Brand', sortable: true },
      { key: 'model', label: 'Model', sortable: true },
      { key: 'serialNumber', label: 'Serial', sortable: true },
      { key: 'status', label: 'Status', sortable: true },
      { key: 'employeeName', label: 'Employee', sortable: true },
      { key: 'location', label: 'Location', sortable: true },
    ],
    total: 0,
    pages: 1,
    totals: { n: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const spec = useMemo(() => {
    const g = catalog.groups.find((item) => item.group === group);
    return g?.reports.find((item) => item.slug === slug) || null;
  }, [catalog, group, slug]);
  const snapshot = Boolean(spec?.snapshot || data.snapshot);
  const rows = (data.rows || []).map((row) => ({
    ...row,
    _assetLink: Boolean(row.assetCode && canAccessPath(user?.role, `/inventory/${row.assetCode}`)),
    _ticketLink: Boolean(row.ticketCode && canAccessPath(user?.role, `/tickets/${row.ticketCode}`)),
    _employeeLink: Boolean(row.employeeCode && canAccessPath(user?.role, `/employees/${row.employeeCode}`)),
  }));

  useEffect(() => {
    getReportCatalog().then((res) => {
      if (res.ok) {
        setCatalog(res);
      }
    });
  }, []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    const params = {
      page,
      limit: PAGE_SIZE,
      sort: sort.key,
      dir: sort.dir,
      category: filters.category,
      department: filters.department,
      status: filters.status,
    };
    if (group !== 'asset') {
      params.from = filters.from;
      params.to = filters.to;
    }
    runReport(group, slug, params).then((res) => {
      if (!live) {
        return;
      }
      if (res.ok) {
        setData(res);
      }
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [group, slug, page, sort.key, sort.dir, filters.category, filters.department, filters.status, filters.from, filters.to]);

  function pickReport(nextGroup, nextSlug) {
    const g = catalog.groups.find((item) => item.group === nextGroup);
    const report = g?.reports.find((item) => item.slug === nextSlug);
    setGroup(nextGroup);
    setSlug(nextSlug);
    setPage(1);
    setSort(defaultSortFor(report));
    setFilters((prev) => ({ ...prev, status: '' }));
  }

  function setFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  function setRange(range) {
    setFilters((prev) => ({ ...prev, from: range.from, to: range.to }));
    setPage(1);
  }

  function clearFilters() {
    setFilters(emptyFilters());
    setPage(1);
  }

  async function handleExport() {
    setExporting(true);
    const result = await exportReport(group, slug, {
      category: filters.category,
      department: filters.department,
      status: filters.status,
      sort: sort.key,
      dir: sort.dir,
      ...(group === 'asset' ? {} : { from: filters.from, to: filters.to }),
    });
    setExporting(false);
    if (!result.ok) {
      notify.error(result.error || 'Could not export this report');
      return;
    }
    const a = document.createElement('a');
    a.href = result.url;
    a.download = `${group}-${slug}.csv`;
    a.click();
    URL.revokeObjectURL(result.url);
    if (result.truncated) {
      notify.error(
        `Exported the first ${result.limit.toLocaleString()} rows — narrow the filters to get the rest.`,
      );
    } else {
      notify.success('Report exported');
    }
  }

  const defaults = emptyFilters();
  // Asset reports are snapshots and hide the date control, so a date left over
  // from a previous report must not light up Clear on a screen showing no date
  // filter at all.
  const datesApply = group !== 'asset';
  const filtered = Boolean(
    filters.category ||
      filters.department ||
      filters.status ||
      (datesApply && (filters.from !== defaults.from || filters.to !== defaults.to)),
  );

  const columns = (data.columns || []).map((col) => ({
    ...col,
    sortable: col.sortable !== false,
    render: (row) => renderCell(col, row),
  }));

  const n = data.totals?.n ?? data.total ?? 0;
  const match = data.totals?.reconciles;
  const statusOptions =
    slug === 'ticket' ? catalog.filters?.ticketStatuses : catalog.filters?.assetStatuses;

  function rowPath(row) {
    if (row._assetLink) {
      return `/inventory/${row.assetCode}`;
    }
    if (row._ticketLink) {
      return `/tickets/${row.ticketCode}`;
    }
    if (row._employeeLink) {
      return `/employees/${row.employeeCode}`;
    }
    return null;
  }

  return (
    <section>
      <PageHeader
        sub={
          group === 'asset'
            ? 'Current inventory. Totals match the dashboard when unfiltered.'
            : 'Filter by date, sort, and export the filtered set.'
        }
        right={
          <Button variant="ghost" loading={exporting} onClick={handleExport}>
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
        }
      />

      <FilterRow>
        <Field label="Report" style={{ flex: '1 1 280px', maxWidth: 360 }}>
          <Select
            value={`${group}/${slug}`}
            onChange={(e) => {
              const [nextGroup, nextSlug] = e.target.value.split('/');
              pickReport(nextGroup, nextSlug);
            }}
            aria-label="Choose report"
          >
            {catalog.groups.flatMap((item) =>
              item.reports.map((report) => (
                <option key={`${item.group}/${report.slug}`} value={`${item.group}/${report.slug}`}>
                  {item.label} — {report.title}
                </option>
              )),
            )}
          </Select>
        </Field>

        {datesApply ? (
          <Field label="Date from / to" style={{ flex: '1 1 260px', maxWidth: 320 }}>
            <DateRangePicker
              from={filters.from}
              to={filters.to}
              min={monthsBack(istDay(), 24)}
              max={istDay()}
              maxSpanDays={90}
              onChange={setRange}
            />
          </Field>
        ) : null}

        <Field label="Department" style={{ flex: '0 1 180px' }}>
          <Select
            value={filters.department}
            onChange={(e) => setFilter('department', e.target.value)}
            aria-label="Department"
          >
            <option value="">All departments</option>
            {(catalog.filters?.departments || []).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Category" style={{ flex: '0 1 180px' }}>
          <Select value={filters.category} onChange={(e) => setFilter('category', e.target.value)} aria-label="Category">
            <option value="">All categories</option>
            {(catalog.filters?.categories || []).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Status" style={{ flex: '0 1 200px' }}>
          <Select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} aria-label="Status">
            <option value="">All statuses</option>
            {statusOptions?.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </Field>

        {filtered ? (
          <Button variant="ghost" size="sm" onClick={clearFilters} style={{ marginBottom: 1 }}>
            Clear
          </Button>
        ) : null}
      </FilterRow>

      <p className="ds-page-head__sub" style={{ margin: '-6px 0 12px' }}>
        {n.toLocaleString()} {n === 1 ? 'row' : 'rows'}
        {snapshot && match === true ? ' · matches the dashboard' : null}
        {snapshot && match === false ? ' · filtered, so this is not the dashboard total' : null}
      </p>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        onRowClick={
          rows.some(rowPath)
            ? (row) => {
                const path = rowPath(row);
                if (path) {
                  navigate(path);
                }
              }
            : undefined
        }
        loading={loading}
        pageSize={PAGE_SIZE}
        alwaysShowPager
        countLabel="rows"
        page={page}
        onPageChange={setPage}
        total={data.total}
        sort={sort}
        onSortChange={(next) => {
          setSort(next);
          setPage(1);
        }}
        empty={
          <EmptyState
            icon="▤"
            title="Nothing in this report"
            sub={filtered ? 'Nothing matches these filters.' : 'No records yet for this report.'}
            actions={
              filtered ? (
                <Button variant="soft" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : null
            }
          />
        }
      />
    </section>
  );
}
