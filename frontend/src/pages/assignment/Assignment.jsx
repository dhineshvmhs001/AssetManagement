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
import FilePicker from '../inventory/FilePicker';
import '../inventory/Inventory.css';

const WRITE = ['ADMIN', 'ASSET_MANAGER', 'ASSET_TEAM'];

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
  const canAssign = WRITE.includes(user?.role);
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
    if (canAssign) {
      load();
    }
  }, [canAssign]);

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
      employeeId: next?.employeeId || prev.employeeId,
      assetIds: [],
      location: next
        ? options.employees.find((person) => person.id === next.employeeId)?.location || prev.location
        : prev.location,
    }));
    setShowAllAssets(false);
  }

  function onEmployee(id) {
    const person = options.employees.find((item) => item.id === id);
    setForm((prev) => ({
      ...prev,
      employeeId: id,
      location: person?.location || prev.location,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.employeeId) {
      notify.error('Pick an employee');
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

  if (!canAssign) {
    return (
      <section>
        <div className="inv-head">
          <div>
            <h2>Assignment</h2>
            <p>Only Admin, Asset Manager, and Asset Team can hand out assets.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="inv-head">
        <div>
          <h2>Assignment</h2>
          <p>Hand available stock to an active employee. Prefer an approved ticket so the request is closed with the Asset IDs.</p>
        </div>
      </div>

      <form className="inv-card inv-form" onSubmit={handleSubmit}>
        <label>
          <span>Approved ticket</span>
          <select value={form.ticketId} onChange={(e) => onTicket(e.target.value)}>
            <option value="">No ticket — walk-up assign</option>
            {options.tickets.map((item) => (
              <option key={item.id} value={item.id}>
                {item.ticketCode} — {item.employeeCode} · {item.itemsLabel || 'request'}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Employee *</span>
          <select value={form.employeeId} onChange={(e) => onEmployee(e.target.value)} required disabled={Boolean(form.ticketId)}>
            <option value="">Select employee</option>
            {options.employees.map((person) => (
              <option key={person.id} value={person.id}>
                {person.employeeCode} — {person.name}
              </option>
            ))}
          </select>
        </label>
        {ticket ? (
          <p className="inv-note">
            Requested: {ticket.itemsLabel}. You can pick only that quantity of each. Choosing
            another of the same type replaces the earlier one. Employee is locked to this ticket.
          </p>
        ) : null}

        <div className="assign-pick">
          <span>Available assets *</span>
          <div className="assign-pick-tools">
            <input
              value={assetSearch}
              onChange={(e) => setAssetSearch(e.target.value)}
              placeholder="Search asset ID, brand, serial…"
            />
            {wanted.size ? (
              <label className="assign-all">
                <input
                  type="checkbox"
                  checked={showAllAssets}
                  onChange={(e) => setShowAllAssets(e.target.checked)}
                />
                Show all available
              </label>
            ) : null}
          </div>
          <div className="assign-asset-list">
            {visibleAssets.map((asset) => (
              <label key={asset.id} className="assign-asset-row">
                <input
                  type="checkbox"
                  checked={form.assetIds.includes(asset.id)}
                  onChange={() => toggleAsset(asset.id)}
                />
                <span>
                  <strong>{asset.assetCode}</strong> · {asset.category} · {asset.brand} {asset.model || ''}
                  <span className="inv-muted"> {asset.serialNumber}</span>
                </span>
              </label>
            ))}
            {!visibleAssets.length ? (
              <p className="inv-muted">No available assets match.</p>
            ) : null}
          </div>
          <p className="inv-muted">
            {wanted.size
              ? [...wanted.entries()]
                  .map(([category, qty]) => `${category} ${selectedByCategory[category] || 0}/${qty}`)
                  .join(' · ')
              : `${form.assetIds.length} selected`}
          </p>
        </div>

        <label>
          <span>Assignment date *</span>
          <input type="date" value={form.assignedAt} onChange={(e) => set('assignedAt', e.target.value)} required />
        </label>
        <label>
          <span>Expected return</span>
          <input type="date" value={form.expectedReturn} onChange={(e) => set('expectedReturn', e.target.value)} />
        </label>
        <label>
          <span>Condition at issue *</span>
          <select value={form.condition} onChange={(e) => set('condition', e.target.value)}>
            {options.conditions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Assignment type *</span>
          <select value={form.assignmentType} onChange={(e) => set('assignmentType', e.target.value)}>
            {options.assignmentTypes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Location</span>
          <input
            value={form.location}
            onChange={(e) => set('location', e.target.value)}
            placeholder={employee?.location || ''}
          />
        </label>
        <label>
          <span>Accessories</span>
          <input
            value={form.accessories}
            onChange={(e) => set('accessories', e.target.value)}
            placeholder="Charger, bag, mouse…"
          />
        </label>
        <label className="inv-span-2">
          <span>Remarks</span>
          <textarea value={form.remarks} onChange={(e) => set('remarks', e.target.value)} rows={2} />
        </label>
        <FilePicker
          label="Handover document"
          hint="Photo of the handover or a signed PDF. Up to 8 files, 8 MB each."
          accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp,image/gif"
          files={documents}
          onChange={setDocuments}
          showPreview
          wide
        />
        <div className="inv-form-actions">
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Saving…' : 'Assign'}
          </button>
        </div>
      </form>

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
            <label>
              <span>Reason *</span>
              <select value={returnForm.reason} onChange={(e) => setReturnForm((prev) => ({ ...prev, reason: e.target.value }))}>
                {options.returnReasons.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Return condition *</span>
              <select
                value={returnForm.condition}
                onChange={(e) => setReturnForm((prev) => ({ ...prev, condition: e.target.value }))}
              >
                {options.returnConditions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
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
