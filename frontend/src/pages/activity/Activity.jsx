import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { exportActivity, listActivity } from '../../api/activity.api';
import { useAuth } from '../../auth/AuthProvider';
import { isTypingTarget } from '../../keyboard/keys';
import { notify } from '../../ui/notify';
import {
  actionTone,
  APP_TIME_ZONE_LABEL,
  Button,
  DataTable,
  DateRangePicker,
  defaultRange,
  EmptyState,
  Field,
  formatDate,
  formatTime,
  FilterRow,
  istDay,
  monthsBack,
  PageHeader,
  Pill,
  Select,
} from '../../ui';
import './Activity.css';

const PAGE_SIZE = 20;

function emptyFilters() {
  return { module: '', action: '', ...defaultRange() };
}

const MODULES = ['Inventory', 'Vendor', 'Assignment', 'Maintenance', 'Employee', 'Tickets', 'Reports', 'Auth'];
const ACTIONS = [
  'Create',
  'Update',
  'Assign',
  'Unassign',
  'Acknowledge',
  'Transfer',
  'Replace',
  'Allocate',
  'Close',
  'Cancel',
  'Deactivate',
  'Import',
  'Export',
  'Status change',
  'Pre-check',
  'Repair',
  'Final check',
  'Approve',
  'Reject',
  'Login',
  'Logout',
];

function when(value) {
  if (!value) {
    return null;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function Activity() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const ownOnly = user?.role === 'ASSET_TEAM';
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ events: [], total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(0);
  const [exporting, setExporting] = useState(false);

  const defaults = defaultRange();
  const filtered = Boolean(
    filters.module || filters.action || filters.from !== defaults.from || filters.to !== defaults.to,
  );
  const rows = data.events || [];

  useEffect(() => {
    let live = true;
    setLoading(true);
    listActivity({ ...filters, page, limit: PAGE_SIZE }).then((res) => {
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
    // The individual values, not `filters` — that object is rebuilt every
    // render and would refetch in a loop.
  }, [filters.module, filters.action, filters.from, filters.to, page]);

  useEffect(() => {
    document.querySelector('.ds-table__row.is-active')?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  useEffect(() => {
    function onKey(e) {
      const list = data.events || [];
      if (isTypingTarget(e.target) || e.target.closest?.('.ds-select') || e.target.closest?.('.ds-daterange') || !list.length) {
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected((i) => Math.min(list.length - 1, i + 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected((i) => Math.max(0, i - 1));
      }
      if (e.key === 'Enter') {
        const row = list[selected];
        if (row?.entityPath) {
          e.preventDefault();
          navigate(row.entityPath);
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [data.events, navigate, selected]);

  function set(key, value) {
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
    const result = await exportActivity(filters);
    setExporting(false);
    if (!result.ok) {
      notify.error(result.error || 'Could not export the activity log');
      return;
    }
    const a = document.createElement('a');
    a.href = result.url;
    a.download = 'activity_log.csv';
    a.click();
    URL.revokeObjectURL(result.url);
    // A capped export is still a useful file, but the user has to know it is
    // not the whole set — otherwise they reconcile against a short CSV.
    if (result.truncated) {
      notify.error(
        `Exported the first ${result.limit.toLocaleString()} rows — narrow the dates or filters to get the rest.`,
      );
    } else {
      notify.success('Activity log exported');
    }
  }

  function openRow(row, index) {
    setSelected(index);
    if (row.entityPath) {
      navigate(row.entityPath);
    }
  }

  const COLUMNS = [
    {
      key: 'at',
      label: 'Date & Time',
      width: '13%',
      render: (row) => {
        const d = when(row.at);
        if (!d) {
          return <span className="ds-empty-value">—</span>;
        }
        return (
          <span className="act-when">
            <strong>{formatDate(d)}</strong>
            <span>{formatTime(d)}</span>
          </span>
        );
      },
    },
    {
      key: 'userName',
      label: 'User / Role',
      width: '16%',
      render: (row) => (
        <span className="act-who">
          <strong>{row.userName}</strong>
          <span>{row.roleLabel || row.role || '—'}</span>
        </span>
      ),
    },
    { key: 'module', label: 'Module', width: '11%' },
    {
      key: 'action',
      label: 'Activity',
      width: '13%',
      render: (row) => {
        const label = row.actionLabel || row.action;
        return label ? (
          <Pill tone={actionTone(label)} upper>
            {label}
          </Pill>
        ) : (
          <span className="ds-empty-value">—</span>
        );
      },
    },
    {
      key: 'description',
      label: 'Description',
      render: (row) =>
        row.description ? (
          <span className="act-desc" title={row.description}>
            {row.description}
          </span>
        ) : (
          <span className="ds-empty-value">—</span>
        ),
    },
    {
      key: 'entityLabel',
      label: 'Entity',
      width: '15%',
      render: (row) =>
        row.entityPath ? (
          <Link to={row.entityPath} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
            {row.entityLabel}
          </Link>
        ) : (
          row.entityLabel || <span className="ds-empty-value">—</span>
        ),
    },
  ];

  return (
    <section>
      <PageHeader
        sub={`${
          ownOnly ? 'Your own actions.' : 'Every significant action.'
        } Defaults to the last 90 days, in ${APP_TIME_ZONE_LABEL}. Each query is capped at 90 days. Read-only. Up/down selects a row, Enter or a click opens it.`}
        right={
          <Button variant="ghost" loading={exporting} onClick={handleExport}>
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
        }
      />

      <FilterRow>
        <Field label="Date range" style={{ flex: '1 1 260px', maxWidth: 320 }}>
          <DateRangePicker
            from={filters.from}
            to={filters.to}
            min={monthsBack(istDay(), 24)}
            max={istDay()}
            maxSpanDays={90}
            onChange={setRange}
          />
        </Field>
        <Field label="Module" style={{ flex: '0 1 200px' }}>
          <Select value={filters.module} onChange={(e) => set('module', e.target.value)} aria-label="Filter by module">
            <option value="">All modules</option>
            {MODULES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Activity" style={{ flex: '0 1 200px' }}>
          <Select value={filters.action} onChange={(e) => set('action', e.target.value)} aria-label="Filter by activity">
            <option value="">All activities</option>
            {ACTIONS.map((item) => (
              <option key={item} value={item}>
                {item}
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

      <DataTable
        columns={COLUMNS}
        rows={rows}
        rowKey={(row) => row.id}
        activeKey={rows[selected]?.id}
        onRowClick={openRow}
        loading={loading}
        pageSize={PAGE_SIZE}
        alwaysShowPager
        countLabel="events"
        page={page}
        onPageChange={setPage}
        total={data.total}
        empty={
          filtered ? (
            <EmptyState
              icon="⌕"
              title="No activity matches these filters"
              sub="Nothing was recorded in this range. Widen the dates or clear the other filters."
              actions={
                <Button variant="soft" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon="▤"
              title={ownOnly ? 'You have no recorded activity yet' : 'No activity yet'}
              sub="Assign, approve, or add an asset and it will be logged here."
            />
          )
        }
      />
    </section>
  );
}
