import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import {
  createAssignment,
  getAssignmentFileUrl,
  getAssignmentOptions,
  listAssignments,
  returnAssignment,
} from '../../api/assignments.api';
import { notify } from '../../ui/notify';
import { DatePicker, Field, Input, istDay, Select, Textarea } from '../../ui';
import FilePicker from '../inventory/FilePicker';
import '../inventory/Inventory.css';
import './Assignment.css';

const VIEW = ['ADMIN', 'ASSET_MANAGER', 'ASSET_TEAM'];
const ASSIGN = ['ADMIN', 'ASSET_TEAM'];

function initials(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function today() {
  return istDay();
}

const EMPTY_FORM = {
  ticketId: '',
  employeeId: '',
  assetIds: [],
  assignedAt: today(),
  expectedReturn: '',
  condition: 'Good',
  location: '',
  assignmentType: 'Permanent',
  accessories: '',
  remarks: '',
};

const EMPTY_OPTIONS = {
  employees: [],
  tickets: [],
  assets: [],
  conditions: ['New', 'Good', 'Fair', 'Damaged'],
  assignmentTypes: ['Permanent', 'Probation', 'Replacement'],
  returnReasons: ['End of assignment', 'Employee Resignation', 'Asset Replacement', 'Repair/Maintenance', 'Transfer', 'Other'],
  returnConditions: ['Good', 'Fair', 'Damaged', 'Non-functional', 'Lost/Incomplete'],
};

export default function Assignment() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const canView = VIEW.includes(user?.role);
  const canAssign = ASSIGN.includes(user?.role);
  const [options, setOptions] = useState(EMPTY_OPTIONS);
  const [assignments, setAssignments] = useState([]);
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, assignedAt: today() }));
  const [assetSearch, setAssetSearch] = useState('');
  const [showAllAssets, setShowAllAssets] = useState(false);
  const [busy, setBusy] = useState(false);
  const [returning, setReturning] = useState(null);
  const [returnForm, setReturnForm] = useState({ reason: 'End of assignment', condition: 'Good' });
  const [documents, setDocuments] = useState([]);
  const [fileUrls, setFileUrls] = useState({});

  function load() {
    getAssignmentOptions().then((res) => {
      if (res.ok) {
        setOptions(res);
      }
    });
    listAssignments({ open: 1 }).then((res) => {
      if (res.ok) {
        setAssignments(res.assignments || []);
      }
    });
  }

  useEffect(() => {
    if (canView) {
      load();
    }
  }, [canView]);

  useEffect(() => {
    const code = searchParams.get('ticket');
    if (!code || !options.tickets.length) {
      return;
    }
    const ticket = options.tickets.find((item) => item.ticketCode === code);
    if (ticket && form.ticketId !== ticket.id) {
      setForm((prev) => ({
        ...prev,
        ticketId: ticket.id,
        employeeId: ticket.employeeId,
      }));
    }
  }, [searchParams, options.tickets]);

  useEffect(() => {
    const paths = assignments.flatMap((row) => (row.documents || []).map((file) => file.path).filter(Boolean));
    if (!paths.length) {
      setFileUrls({});
      return undefined;
    }
    let live = true;
    const made = [];
    Promise.all(
      paths.map((path) => getAssignmentFileUrl(path).then((url) => {
        if (url) {
          made.push(url);
        }
        return [path, url];
      })),
    ).then((pairs) => {
      if (live) {
        setFileUrls(Object.fromEntries(pairs.filter(([, url]) => url)));
      }
    });
    return () => {
      live = false;
      made.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [assignments]);

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const ticket = options.tickets.find((item) => item.id === form.ticketId);
  const employee = options.employees.find((item) => item.id === form.employeeId);
  const wanted = new Map((ticket?.items || []).map((item) => [item.category, Number(item.quantity) || 1]));

  const visibleAssets = useMemo(() => {
    const q = assetSearch.trim().toLowerCase();
    return (options.assets || []).filter((asset) => {
      if (!showAllAssets && wanted.size && !wanted.has(asset.category)) {
        return false;
      }
      if (!q) {
        return true;
      }
      return [asset.assetCode, asset.category, asset.brand, asset.model, asset.serialNumber]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [options.assets, assetSearch, showAllAssets, ticket]);

  const selectedByCategory = useMemo(() => {
    const counts = {};
    for (const id of form.assetIds) {
      const asset = options.assets.find((item) => item.id === id);
      if (!asset) {
        continue;
      }
      counts[asset.category] = (counts[asset.category] || 0) + 1;
    }
    return counts;
  }, [form.assetIds, options.assets]);

  const pickedAssets = useMemo(
    () => form.assetIds.map((id) => options.assets.find((item) => item.id === id)).filter(Boolean),
    [form.assetIds, options.assets],
  );

  function toggleAsset(id) {
    const asset = options.assets.find((item) => item.id === id);
    if (!asset) {
      return;
    }
    if (form.assetIds.includes(id)) {
      setForm((prev) => ({ ...prev, assetIds: prev.assetIds.filter((item) => item !== id) }));
      return;
    }
    if (wanted.size && !wanted.has(asset.category)) {
      notify.error(`This ticket did not request ${asset.category}`);
      return;
    }

    setForm((prev) => {
      if (wanted.size) {
        const limit = wanted.get(asset.category);
        const same = prev.assetIds.filter((item) => {
          const picked = options.assets.find((row) => row.id === item);
          return picked?.category === asset.category;
        });
        if (same.length >= limit) {
          return {
            ...prev,
            assetIds: [...prev.assetIds.filter((item) => item !== same[0]), id],
          };
        }
      }
      return { ...prev, assetIds: [...prev.assetIds, id] };
    });
  }

  function onTicket(id) {
    const next = options.tickets.find((item) => item.id === id);
    setForm((prev) => ({
      ...prev,
      ticketId: id,
      employeeId: next?.employeeId || '',
      assetIds: [],
      location: next
        ? options.employees.find((person) => person.id === next.employeeId)?.location || ''
        : '',
    }));
    setShowAllAssets(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.ticketId) {
      notify.error('Pick a ticket');
      return;
    }
    if (!form.employeeId) {
      notify.error('This ticket has no employee');
      return;
    }
    if (!form.assetIds.length) {
      notify.error('Pick at least one available asset');
      return;
    }
    setBusy(true);
    const data = await createAssignment(form, { documents });
    setBusy(false);
    if (!data.ok) {
      notify.error(data.error || 'Could not assign');
      return;
    }
    notify.success(
      data.ticketCode
        ? `Assigned ${data.assignments.length} asset(s). Ticket ${data.ticketCode} closed.`
        : `Assigned ${data.assignments.length} asset(s)`,
    );
    setForm({ ...EMPTY_FORM, assignedAt: today() });
    setAssetSearch('');
    setDocuments([]);
    load();
  }

  async function handleReturn(e) {
    e.preventDefault();
    if (!returning) {
      return;
    }
    setBusy(true);
    const data = await returnAssignment(returning.assignmentCode, returnForm);
    setBusy(false);
    if (!data.ok) {
      notify.error(data.error || 'Could not return');
      return;
    }
    notify.success(`${returning.assetCode} returned — pending pre-check`);
    setReturning(null);
    load();
  }

  if (!canView) {
    return (
      <section>
        <div className="inv-head">
          <p>Only Admin and Asset Team can hand out assets.</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="inv-head">
        <p>
          {canAssign
            ? 'Pick a ticket. The employee is taken from that ticket. Then assign matching stock.'
            : 'Send the ticket to Asset Team from Tickets. They assign stock here. You do not pick an employee on this page.'}
        </p>
      </div>

      {canAssign ? (
      <form className="asg-grid" onSubmit={handleSubmit}>
        <div className="asg-main">
          <section className="asg-step">
            <header className="asg-step-head">
              <span className="asg-step-num">1</span>
              <div className="asg-step-title">
                <h3>
                  Which ticket?<span className="inv-req">*</span>
                </h3>
                <p>The employee and the requested items come from the ticket.</p>
              </div>
            </header>

            <Select value={form.ticketId} onChange={(e) => onTicket(e.target.value)} aria-label="Ticket from Asset Team">
              <option value="">Select ticket</option>
              {options.tickets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.ticketCode} — {item.employeeCode} · {item.itemsLabel || 'request'}
                </option>
              ))}
            </Select>

            {ticket ? (
              <div className="asg-ticket">
                <div className="asg-ticket-who">
                  <span className="asg-avatar">{initials(employee?.name || ticket.employeeCode)}</span>
                  <span className="asg-who-name">
                    {employee?.name || 'Employee on ticket'}
                    <span>
                      {ticket.employeeCode}
                      {employee?.department ? ` · ${employee.department}` : ''}
                    </span>
                  </span>
                </div>
                {wanted.size ? (
                  <div className="asg-quotas">
                    {[...wanted.entries()].map(([category, qty]) => {
                      const got = selectedByCategory[category] || 0;
                      return (
                        <span key={category} className={`asg-quota-chip${got >= qty ? ' is-done' : ''}`}>
                          {category} {got}/{qty}
                        </span>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="asg-empty">Pick a ticket to start. Tickets appear here once Asset Manager sends them to Asset Team.</p>
            )}
          </section>

          <section className={`asg-step${ticket ? '' : ' is-locked'}`}>
            <header className="asg-step-head">
              <span className="asg-step-num">2</span>
              <div className="asg-step-title">
                <h3>
                  Which assets?<span className="inv-req">*</span>
                </h3>
                <p>Only stock matching the request, unless you widen it.</p>
              </div>
              <span className={`asg-chip${form.assetIds.length ? ' is-on' : ''}`}>
                {form.assetIds.length} selected
              </span>
            </header>

            {ticket ? (
              <div className="asg-step-body">
                <div className="asg-pick-tools">
                  <Input
                    value={assetSearch}
                    onChange={(e) => setAssetSearch(e.target.value)}
                    placeholder="Search asset ID, brand, serial…"
                    aria-label="Search assets"
                  />
                  {wanted.size ? (
                    <label className="asg-toggle">
                      <input
                        type="checkbox"
                        checked={showAllAssets}
                        onChange={(e) => setShowAllAssets(e.target.checked)}
                      />
                      Show all available
                    </label>
                  ) : null}
                </div>

                <div className="asg-list">
                  {visibleAssets.map((asset) => {
                    const on = form.assetIds.includes(asset.id);
                    return (
                      <label key={asset.id} className={`asg-row${on ? ' is-on' : ''}`}>
                        <input type="checkbox" checked={on} onChange={() => toggleAsset(asset.id)} />
                        <span className="asg-row-main">
                          <span className="asg-code">{asset.assetCode}</span>
                          <span className="asg-tag">{asset.category}</span>
                          <span className="asg-desc">
                            {asset.brand} {asset.model || ''}
                          </span>
                          {asset.serialNumber ? <span className="asg-serial">{asset.serialNumber}</span> : null}
                        </span>
                      </label>
                    );
                  })}
                  {!visibleAssets.length ? (
                    <p className="asg-empty">
                      {assetSearch ? `Nothing matches “${assetSearch}”.` : 'No available stock for this request.'}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="asg-lock-note">Pick a ticket first.</p>
            )}
          </section>

          <section className={`asg-step${ticket ? '' : ' is-locked'}`}>
            <header className="asg-step-head">
              <span className="asg-step-num">3</span>
              <div className="asg-step-title">
                <h3>Terms and proof</h3>
                <p>Dates, condition at issue, and the signed handover.</p>
              </div>
            </header>
            <div className={`inv-form asg-step-body${ticket ? '' : ' is-locked'}`} inert={!ticket}>
              <Field label="Assignment date" required>
                <DatePicker
                  value={form.assignedAt}
                  onChange={(value) => set('assignedAt', value)}
                  max={istDay()}
                  required
                  aria-label="Assigned on"
                />
              </Field>
              <Field label="Expected return">
                <DatePicker
                  value={form.expectedReturn}
                  onChange={(value) => set('expectedReturn', value)}
                  min={form.assignedAt || undefined}
                  aria-label="Expected return"
                />
              </Field>
              <Field label="Condition at issue" required>
                <Select value={form.condition} onChange={(e) => set('condition', e.target.value)} aria-label="Condition at issue">
                  {options.conditions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Assignment type" required>
                <Select value={form.assignmentType} onChange={(e) => set('assignmentType', e.target.value)} aria-label="Assignment type">
                  {options.assignmentTypes.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Location">
                <Input
                  value={form.location}
                  onChange={(e) => set('location', e.target.value)}
                  placeholder={employee?.location || ''}
                />
              </Field>
              <Field label="Accessories">
                <Input
                  value={form.accessories}
                  onChange={(e) => set('accessories', e.target.value)}
                  placeholder="Charger, bag, mouse…"
                />
              </Field>
              <Field label="Remarks" full>
                <Textarea value={form.remarks} onChange={(e) => set('remarks', e.target.value)} rows={2} />
              </Field>
              <FilePicker
                label="Handover document"
                hint="Photo of the handover or a signed PDF. Up to 8 files, 8 MB each."
                accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp,image/gif"
                files={documents}
                onChange={setDocuments}
                showPreview
                wide
              />
            </div>
          </section>
        </div>

        <aside className="asg-side">
          <div className="asg-summary">
            <h3>Handover summary</h3>

            {ticket ? (
              <div className="asg-ticket-who">
                <span className="asg-avatar">{initials(employee?.name || ticket.employeeCode)}</span>
                <span className="asg-who-name">
                  {employee?.name || ticket.employeeCode}
                  <span>
                    {ticket.ticketCode} · {ticket.employeeCode}
                  </span>
                </span>
              </div>
            ) : (
              <p className="asg-blank">No ticket picked yet</p>
            )}

            {pickedAssets.length ? (
              <div className="asg-picked">
                {pickedAssets.map((asset) => (
                  <span key={asset.id} className="asg-picked-item">
                    <strong>{asset.assetCode}</strong>
                    <span className="asg-picked-sub">
                      {asset.brand} {asset.model || ''}
                    </span>
                    <button
                      type="button"
                      className="asg-drop"
                      onClick={() => toggleAsset(asset.id)}
                      aria-label={`Remove ${asset.assetCode}`}
                      title="Remove"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="asg-blank">No assets picked yet</p>
            )}

            <div className="asg-meta">
              <div>
                <span className="asg-meta-key">From</span>
                <span className="asg-meta-val">{form.assignedAt || '—'}</span>
              </div>
              <div>
                <span className="asg-meta-key">Expected back</span>
                <span className="asg-meta-val">{form.expectedReturn || 'Open ended'}</span>
              </div>
              <div>
                <span className="asg-meta-key">Type</span>
                <span className="asg-meta-val">{form.assignmentType}</span>
              </div>
              <div>
                <span className="asg-meta-key">Condition</span>
                <span className="asg-meta-val">{form.condition}</span>
              </div>
              <div>
                <span className="asg-meta-key">Documents</span>
                <span className="asg-meta-val">{documents.length || 'None'}</span>
              </div>
            </div>

            <button type="submit" className="btn primary asg-go" disabled={busy}>
              {busy
                ? 'Saving…'
                : form.assetIds.length
                  ? `Assign ${form.assetIds.length} ${form.assetIds.length === 1 ? 'asset' : 'assets'}`
                  : 'Assign'}
            </button>
            <p className="asg-note">Assets move to Assigned and the ticket closes.</p>
          </div>
        </aside>
      </form>
      ) : null}

      <div className="inv-card" style={{ marginTop: 16 }}>
        <h3>Currently assigned</h3>
        {assignments.length ? (
          <div className="inv-table-wrap" style={{ border: 0, boxShadow: 'none', borderRadius: 0 }}>
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Assignment</th>
                  <th>Asset</th>
                  <th>Employee</th>
                  <th>Ticket</th>
                  <th>Date</th>
                  <th>Proof</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((row) => (
                  <tr key={row.id}>
                    <td>{row.assignmentCode}</td>
                    <td>
                      <Link to={`/inventory/${row.assetCode}`}>{row.assetCode}</Link>
                      <div className="inv-muted">
                        {row.category} · {row.brand}
                      </div>
                    </td>
                    <td>
                      <Link to={`/employees/${row.employeeCode}`}>
                        {row.employeeCode} — {row.employeeName}
                      </Link>
                    </td>
                    <td>
                      {row.ticketCode ? <Link to={`/tickets/${row.ticketCode}`}>{row.ticketCode}</Link> : '—'}
                    </td>
                    <td>{row.assignedAt || '—'}</td>
                    <td>
                      {row.documents?.length ? (
                        <ul className="inv-file-links">
                          {row.documents.map((file) => (
                            <li key={file.stored || file.name}>
                              {fileUrls[file.path] ? (
                                <a href={fileUrls[file.path]} target="_blank" rel="noreferrer">
                                  {file.name}
                                </a>
                              ) : (
                                file.name
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => {
                          setReturning(row);
                          setReturnForm({ reason: 'End of assignment', condition: 'Good' });
                        }}
                      >
                        Return
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="inv-muted">None open. Assign above, or wait for an approved ticket.</p>
        )}
      </div>

      {returning ? (
        <form className="inv-card" style={{ marginTop: 16 }} onSubmit={handleReturn}>
          <h3>
            Return {returning.assetCode} from {returning.employeeName}
          </h3>
          <p className="inv-muted">
            Asset goes to Pending Pre-Check. Inspect it on{' '}
            <Link to="/maintenance">Maintenance</Link>.
          </p>
          <div className="inv-form" style={{ marginTop: 12 }}>
            <Field label="Reason" required>
              <Select
                value={returnForm.reason}
                onChange={(e) => setReturnForm((prev) => ({ ...prev, reason: e.target.value }))}
                aria-label="Return reason"
              >
                {options.returnReasons.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Return condition" required>
              <Select
                value={returnForm.condition}
                onChange={(e) => setReturnForm((prev) => ({ ...prev, condition: e.target.value }))}
                aria-label="Return condition"
              >
                {options.returnConditions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="inv-form-actions">
            <button type="button" className="btn ghost" onClick={() => setReturning(null)}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={busy}>
              Confirm return
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
