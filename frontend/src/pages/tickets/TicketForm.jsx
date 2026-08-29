import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { setNavGuard, clearNavGuard } from '../../keyboard/navGuard';
import { getTicketOptions } from '../../api/tickets.api';
import { listEmployees } from '../../api/employees.api';
import FilePicker from '../inventory/FilePicker';

const EMPTY_ITEM = { category: '', quantity: '1' };

const EMPTY = {
  employeeId: '',
  items: [{ ...EMPTY_ITEM }],
  priority: 'MEDIUM',
  needDate: '',
  remarks: '',
};

const FALLBACK = {
  requiredFields: ['employeeId', 'category'],
  productionMode: false,
  categories: ['Laptop', 'Monitor', 'Mouse', 'Keyboard', 'Phone', 'Headphone', 'Charger'],
  priorities: ['LOW', 'MEDIUM', 'HIGH'],
};

const PRIORITY_LABEL = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' };

export default function TicketForm({ busy, onSubmit, onCancel }) {
  const [options, setOptions] = useState(FALLBACK);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [attachments, setAttachments] = useState([]);
  const [baseline] = useState(() => JSON.stringify(EMPTY));

  useEffect(() => {
    getTicketOptions().then((res) => {
      if (res.ok) {
        setOptions(res);
      }
    });
    listEmployees({ status: 'ACTIVE', limit: 200 }).then((res) => {
      if (res.ok) {
        setEmployees(res.employees || []);
      }
    });
  }, []);

  const dirty = JSON.stringify(form) !== baseline || attachments.length > 0;

  useEffect(() => {
    if (!dirty) {
      return undefined;
    }
    const guard = () => window.confirm('Leave this form? Your unsaved changes will be lost.');
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    setNavGuard(guard);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      clearNavGuard(guard);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [dirty]);

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setItem(index, key, value) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    }));
  }

  function addItem() {
    setForm((prev) => ({ ...prev, items: [...prev.items, { ...EMPTY_ITEM }] }));
  }

  function removeItem(index) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.length === 1 ? prev.items : prev.items.filter((_, i) => i !== index),
    }));
  }

  function need(key) {
    return (options.requiredFields || []).includes(key);
  }

  function star(key) {
    return need(key) ? <span className="inv-req"> *</span> : null;
  }

  const selected = employees.find((person) => person.id === form.employeeId);

  function handleSubmit(e) {
    e.preventDefault();
    if (need('employeeId') && !form.employeeId) {
      return onSubmit(null, 'Employee is required');
    }
    const items = (form.items || [])
      .map((item) => ({
        category: String(item.category || '').trim(),
        quantity: Number(item.quantity),
      }))
      .filter((item) => item.category);
    if (!items.length) {
      return onSubmit(null, 'Add at least one asset');
    }
    if (items.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1)) {
      return onSubmit(null, 'Quantity must be at least 1');
    }
    if (need('priority') && !form.priority) {
      return onSubmit(null, 'Priority is required');
    }
    if (need('needDate') && !form.needDate) {
      return onSubmit(null, 'Need date is required');
    }
    if (need('attachments') && !attachments.length) {
      return onSubmit(null, 'Attachments are required');
    }
    return onSubmit({ ...form, items }, null, { attachments });
  }

  function leave() {
    if (!dirty || window.confirm('Leave this form? Your unsaved changes will be lost.')) {
      onCancel();
    }
  }

  const categories = options.categories || FALLBACK.categories;
  const priorities = options.priorities || FALLBACK.priorities;

  return (
    <form className="inv-card inv-form" onSubmit={handleSubmit}>
      <p className="inv-note">
        If the person is not in Employee Master, add them first. Add one or more assets (laptop, keyboard,
        mouse…). On save the manager gets an approve/reject email.
      </p>

      <label>
        <span>Employee{star('employeeId')}</span>
        <select value={form.employeeId} onChange={(e) => set('employeeId', e.target.value)} required={need('employeeId')}>
          <option value="">{employees.length ? 'Select employee' : 'Add an employee first'}</option>
          {employees.map((person) => (
            <option key={person.id} value={person.id}>
              {person.employeeCode} — {person.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Department</span>
        <input value={selected?.department || ''} disabled placeholder="From employee" />
      </label>
      <label>
        <span>Joining date</span>
        <input value={selected?.joiningDate || ''} disabled placeholder="From employee" />
      </label>
      <label>
        <span>Manager</span>
        <input
          value={selected?.managerName ? `${selected.managerName}${selected.managerEmail ? ` · ${selected.managerEmail}` : ''}` : ''}
          disabled
          placeholder="From employee"
        />
      </label>

      <div className="ticket-items">
        <span>
          Requested assets{star('category')}
        </span>
        {form.items.map((item, index) => (
          <div className="ticket-item-row" key={index}>
            <label>
              <span>Category</span>
              <select
                value={item.category}
                onChange={(e) => setItem(index, 'category', e.target.value)}
                required
              >
                <option value="">Select category</option>
                {categories.map((name) => (
                  <option
                    key={name}
                    value={name}
                    disabled={form.items.some((row, i) => i !== index && row.category === name)}
                  >
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Qty</span>
              <input
                type="number"
                min="1"
                max="99"
                value={item.quantity}
                onChange={(e) => setItem(index, 'quantity', e.target.value)}
                required
              />
            </label>
            <button
              type="button"
              className="btn ghost"
              onClick={() => removeItem(index)}
              disabled={form.items.length === 1}
            >
              Remove
            </button>
          </div>
        ))}
        {form.items.length < categories.length ? (
          <button type="button" className="btn ghost" onClick={addItem}>
            Add another asset
          </button>
        ) : null}
      </div>

      <label>
        <span>Priority{star('priority')}</span>
        <select value={form.priority} onChange={(e) => set('priority', e.target.value)} required={need('priority')}>
          {priorities.map((item) => (
            <option key={item} value={item}>
              {PRIORITY_LABEL[item] || item}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Need date{star('needDate')}</span>
        <input type="date" value={form.needDate} onChange={(e) => set('needDate', e.target.value)} required={need('needDate')} />
      </label>
      <label className="inv-span-2">
        <span>Remarks</span>
        <textarea value={form.remarks} onChange={(e) => set('remarks', e.target.value)} rows={3} />
      </label>

      {!employees.length ? (
        <p className="inv-note">
          <Link to="/employees/add">Add employee</Link> first, then create the ticket.
        </p>
      ) : null}

      <FilePicker
        label="Attachments"
        hint="Onboarding note, request letter. PDF, Word, or image. Up to 8 files, 8 MB each."
        accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp,image/gif"
        files={attachments}
        onChange={setAttachments}
        required={need('attachments')}
        wide
      />

      <div className="inv-form-actions">
        <button type="button" className="btn ghost" onClick={leave}>
          Cancel
        </button>
        <button type="submit" className="btn primary" disabled={busy || !employees.length}>
          {busy ? 'Saving…' : 'Create ticket'}
        </button>
      </div>
    </form>
  );
}
