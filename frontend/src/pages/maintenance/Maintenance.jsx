import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import {
  completeRepair,
  getMaintenanceOptions,
  listPrecheckQueue,
  listRecentChecks,
  listRepairs,
  submitPrecheck,
} from '../../api/maintenance.api';
import { notify } from '../../ui/notify';
import { Field, Input, Select, Textarea } from '../../ui';
import FilePicker from '../inventory/FilePicker';
import '../inventory/Inventory.css';

const WRITE = ['ADMIN', 'ASSET_MANAGER', 'ASSET_TEAM'];

const EMPTY_OPTIONS = {
  results: [],
  conditions: ['New', 'Good', 'Fair', 'Damaged'],
  warrantyStatuses: ['In warranty', 'Out of warranty', 'Claim filed'],
  repairStatuses: ['Open', 'In progress', 'Waiting parts'],
  completeOutcomes: [],
  vendors: [],
};

function emptyInspect(asset) {
  return {
    result: 'PASS',
    condition: asset?.condition || 'Good',
    accessories: asset?.lastAssignment?.accessories || '',
    notes: '',
    warrantyApplicable: Boolean(asset?.warrantyEnd),
    warrantyStatus: 'In warranty',
    warrantyExpiry: asset?.warrantyEnd || '',
    claimNumber: '',
    serviceProvider: '',
    repairCost: '',
    repairDetails: '',
    repairStatus: 'Open',
  };
}

export default function Maintenance() {
  const { user } = useAuth();
  const canWrite = WRITE.includes(user?.role);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'queue';
  const [options, setOptions] = useState(EMPTY_OPTIONS);
  const [queue, setQueue] = useState([]);
  const [repairs, setRepairs] = useState([]);
  const [recent, setRecent] = useState([]);
  const [inspecting, setInspecting] = useState(null);
  const [form, setForm] = useState(() => emptyInspect());
  const [photos, setPhotos] = useState([]);
  const [repairing, setRepairing] = useState(null);
  const [repairForm, setRepairForm] = useState({ outcome: 'AVAILABLE', notes: '', repairCost: '' });
  const [busy, setBusy] = useState(false);

  function setTab(next) {
    const nextParams = new URLSearchParams(searchParams);
    if (next === 'queue') {
      nextParams.delete('tab');
    } else {
      nextParams.set('tab', next);
    }
    setSearchParams(nextParams, { replace: true });
  }

  function load() {
    listPrecheckQueue().then((res) => {
      if (res.ok) {
        setQueue(res.assets || []);
      }
    });
    listRepairs().then((res) => {
      if (res.ok) {
        setRepairs(res.assets || []);
      }
    });
    listRecentChecks().then((res) => {
      if (res.ok) {
        setRecent(res.checks || []);
      }
    });
  }

  useEffect(() => {
    if (!canWrite) {
      return;
    }
    getMaintenanceOptions().then((res) => {
      if (res.ok) {
        setOptions(res);
      }
    });
    load();
  }, [canWrite]);

  useEffect(() => {
    const code = searchParams.get('asset');
    if (!code || !queue.length || inspecting) {
      return;
    }
    const asset = queue.find((row) => row.assetCode === code);
    if (asset) {
      openInspect(asset);
    }
  }, [queue]);

  function openInspect(asset) {
    setRepairing(null);
    setInspecting(asset);
    setForm(emptyInspect(asset));
    setPhotos([]);
  }

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleInspect(e) {
    e.preventDefault();
    if (!inspecting) {
      return;
    }
    setBusy(true);
    const data = await submitPrecheck(inspecting.assetCode, form, photos);
    setBusy(false);
    if (!data.ok) {
      notify.error(data.error || 'Could not save pre-check');
      return;
    }
    notify.success(
      form.result === 'REPAIR'
        ? `${inspecting.assetCode} sent to repair`
        : `${inspecting.assetCode} marked ${data.check?.assetStatusLabel || 'done'}`,
    );
    setInspecting(null);
    setPhotos([]);
    load();
    if (form.result === 'REPAIR') {
      setTab('repairs');
    }
  }

  async function handleRepair(e) {
    e.preventDefault();
    if (!repairing) {
      return;
    }
    setBusy(true);
    const data = await completeRepair(repairing.assetCode, repairForm);
    setBusy(false);
    if (!data.ok) {
      notify.error(data.error || 'Could not complete repair');
      return;
    }
    notify.success(`${repairing.assetCode} — ${data.statusLabel}`);
    setRepairing(null);
    load();
    setTab('recent');
  }

  if (!canWrite) {
    return (
      <section>
        <div className="inv-head">
          <p>Only Asset Team, Asset Manager, and Admin can inspect returned stock.</p>
        </div>
      </section>
    );
  }

  const needsRepair = form.result === 'REPAIR';
  const claimNeeded = form.warrantyApplicable && form.warrantyStatus === 'Claim filed';

  return (
    <section>
      <div className="inv-head">
        <p>Returned assets wait here. Inspect, then they go back to stock, repair, or out of service.</p>
      </div>

      <nav className="inv-sub" aria-label="Maintenance">
        <button type="button" className={tab === 'queue' ? 'active' : undefined} onClick={() => setTab('queue')}>
          Pre-check ({queue.length})
        </button>
        <button type="button" className={tab === 'repairs' ? 'active' : undefined} onClick={() => setTab('repairs')}>
          Under repair ({repairs.length})
        </button>
        <button type="button" className={tab === 'recent' ? 'active' : undefined} onClick={() => setTab('recent')}>
          Recent
        </button>
      </nav>

      {tab === 'queue' ? (
        <div className="inv-card">
          <h3>Pending pre-check</h3>
          {queue.length ? (
            <div className="inv-table-wrap" style={{ border: 0, boxShadow: 'none', borderRadius: 0 }}>
              <table className="inv-table">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Returned from</th>
                    <th>Return condition</th>
                    <th>Returned</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((row) => (
                    <tr key={row.id} className={inspecting?.id === row.id ? 'is-selected' : undefined}>
                      <td>
                        <Link to={`/inventory/${row.assetCode}`}>{row.assetCode}</Link>
                        <div className="inv-muted">
                          {row.category} · {row.brand} {row.model || ''}
                        </div>
                      </td>
                      <td>
                        {row.lastAssignment ? (
                          <Link to={`/employees/${row.lastAssignment.employeeCode}`}>
                            {row.lastAssignment.employeeCode} — {row.lastAssignment.employeeName}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{row.lastAssignment?.returnCondition || row.condition || '—'}</td>
                      <td>
                        {row.lastAssignment?.returnedAt
                          ? String(row.lastAssignment.returnedAt).slice(0, 10)
                          : '—'}
                      </td>
                      <td>
                        <button type="button" className="btn ghost" onClick={() => openInspect(row)}>
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="inv-muted">Nothing waiting. Return an assignment to land it here.</p>
          )}
        </div>
      ) : null}

      {tab === 'repairs' ? (
        <div className="inv-card">
          <h3>Under repair</h3>
          {repairs.length ? (
            <div className="inv-table-wrap" style={{ border: 0, boxShadow: 'none', borderRadius: 0 }}>
              <table className="inv-table">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Issue</th>
                    <th>Provider</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {repairs.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <Link to={`/inventory/${row.assetCode}`}>{row.assetCode}</Link>
                        <div className="inv-muted">
                          {row.category} · {row.brand}
                        </div>
                      </td>
                      <td>{row.openCheck?.repairDetails || row.openCheck?.notes || '—'}</td>
                      <td>{row.openCheck?.serviceProvider || '—'}</td>
                      <td>{row.openCheck?.repairStatus || 'Open'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => {
                            setInspecting(null);
                            setRepairing(row);
                            setRepairForm({
                              outcome: 'AVAILABLE',
                              notes: '',
                              repairCost: row.openCheck?.repairCost || '',
                            });
                          }}
                        >
                          Complete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="inv-muted">No assets in repair. Fail a pre-check with “Needs repair” to add one.</p>
          )}
        </div>
      ) : null}

      {tab === 'recent' ? (
        <div className="inv-card">
          <h3>Recent checks</h3>
          {recent.length ? (
            <div className="inv-table-wrap" style={{ border: 0, boxShadow: 'none', borderRadius: 0 }}>
              <table className="inv-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Asset</th>
                    <th>Result</th>
                    <th>Now</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((row) => (
                    <tr key={row.id}>
                      <td>{String(row.completedAt || row.createdAt).slice(0, 10)}</td>
                      <td>
                        <Link to={`/inventory/${row.assetCode}`}>{row.assetCode}</Link>
                      </td>
                      <td>{row.resultLabel || row.result}</td>
                      <td>{row.assetStatusLabel || '—'}</td>
                      <td>{row.checkedBy || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="inv-muted">No inspections yet.</p>
          )}
        </div>
      ) : null}

      {inspecting ? (
        <form className="inv-card" style={{ marginTop: 16 }} onSubmit={handleInspect}>
          <h3>
            Inspect {inspecting.assetCode}
            <span className="inv-muted">
              {' '}
              · {inspecting.category} · {inspecting.brand} {inspecting.model || ''}
            </span>
          </h3>
          {inspecting.lastAssignment ? (
            <p className="inv-muted">
              Last held by {inspecting.lastAssignment.employeeName}. Return reason:{' '}
              {inspecting.lastAssignment.returnReason || '—'} ({inspecting.lastAssignment.returnCondition || '—'}).
            </p>
          ) : null}

          <div className="inv-form" style={{ marginTop: 12 }}>
            <Field label="Result" required>
              <Select value={form.result} onChange={(e) => set('result', e.target.value)} aria-label="Result">
                {(options.results.length
                  ? options.results
                  : [
                      { value: 'PASS', label: 'Pass — available' },
                      { value: 'REPAIR', label: 'Needs repair' },
                      { value: 'DAMAGED', label: 'Damaged — not usable' },
                      { value: 'LOST', label: 'Lost / incomplete' },
                      { value: 'RETIRED', label: 'Retire / dispose' },
                    ]
                ).map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Condition after check">
              <Select value={form.condition} onChange={(e) => set('condition', e.target.value)} aria-label="Condition after check">
                {options.conditions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Accessories">
              <Input
                value={form.accessories}
                onChange={(e) => set('accessories', e.target.value)}
                placeholder="Charger, bag, mouse present?"
              />
            </Field>
            <Field label="Notes" required={form.result !== 'PASS'} full>
              <Textarea
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                rows={2}
                required={form.result !== 'PASS'}
              />
            </Field>

            <label className="assign-all" style={{ alignSelf: 'center' }}>
              <input
                type="checkbox"
                checked={form.warrantyApplicable}
                onChange={(e) => set('warrantyApplicable', e.target.checked)}
              />
              Warranty applies
            </label>
            {form.warrantyApplicable ? (
              <>
                <Field label="Warranty status">
                  <Select value={form.warrantyStatus} onChange={(e) => set('warrantyStatus', e.target.value)} aria-label="Warranty status">
                    {options.warrantyStatuses.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Warranty expiry">
                  <Input
                    type="date"
                    value={form.warrantyExpiry}
                    onChange={(e) => set('warrantyExpiry', e.target.value)}
                  />
                </Field>
                {claimNeeded ? (
                  <Field label="Claim number" required>
                    <Input
                      value={form.claimNumber}
                      onChange={(e) => set('claimNumber', e.target.value)}
                      required
                    />
                  </Field>
                ) : null}
              </>
            ) : null}

            {needsRepair ? (
              <>
                <Field label="Service provider">
                  <Input
                    list="maint-vendors"
                    value={form.serviceProvider}
                    onChange={(e) => set('serviceProvider', e.target.value)}
                    placeholder="Vendor or workshop"
                  />
                  <datalist id="maint-vendors">
                    {options.vendors.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </Field>
                <Field label="Repair status">
                  <Select value={form.repairStatus} onChange={(e) => set('repairStatus', e.target.value)} aria-label="Repair status">
                    {options.repairStatuses.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Estimated cost">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.repairCost}
                    onChange={(e) => set('repairCost', e.target.value)}
                  />
                </Field>
                <Field label="What needs repair" required full>
                  <Textarea
                    value={form.repairDetails}
                    onChange={(e) => set('repairDetails', e.target.value)}
                    rows={2}
                    required
                  />
                </Field>
              </>
            ) : null}

            <div className="inv-span-2">
              <FilePicker
                label="Photos"
                hint="Optional. Damage, serial plate, accessories."
                accept="image/*"
                files={photos}
                onChange={setPhotos}
                showPreview
                dropSub="Images · up to 8 · 8 MB each"
              />
            </div>
          </div>
          <div className="inv-form-actions">
            <button type="button" className="btn ghost" onClick={() => setInspecting(null)}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save pre-check'}
            </button>
          </div>
        </form>
      ) : null}

      {repairing ? (
        <form className="inv-card" style={{ marginTop: 16 }} onSubmit={handleRepair}>
          <h3>Complete repair — {repairing.assetCode}</h3>
          <p className="inv-muted">{repairing.openCheck?.repairDetails || repairing.openCheck?.notes || ''}</p>
          <div className="inv-form" style={{ marginTop: 12 }}>
            <Field label="Outcome" required>
              <Select
                value={repairForm.outcome}
                onChange={(e) => setRepairForm((prev) => ({ ...prev, outcome: e.target.value }))}
                aria-label="Outcome"
              >
                {(options.completeOutcomes.length
                  ? options.completeOutcomes
                  : [
                      { value: 'AVAILABLE', label: 'Repair done — available' },
                      { value: 'DAMAGED', label: 'Still damaged' },
                      { value: 'RETIRED', label: 'Retire / dispose' },
                    ]
                ).map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Final cost">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={repairForm.repairCost}
                onChange={(e) => setRepairForm((prev) => ({ ...prev, repairCost: e.target.value }))}
              />
            </Field>
            <Field label="Notes" full>
              <Textarea
                value={repairForm.notes}
                onChange={(e) => setRepairForm((prev) => ({ ...prev, notes: e.target.value }))}
                rows={2}
              />
            </Field>
          </div>
          <div className="inv-form-actions">
            <button type="button" className="btn ghost" onClick={() => setRepairing(null)}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? 'Saving…' : 'Complete repair'}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
