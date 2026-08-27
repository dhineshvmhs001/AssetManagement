import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { setNavGuard, clearNavGuard } from '../../keyboard/navGuard';
import { getTicketOptions } from '../../api/tickets.api';
import { listEmployees } from '../../api/employees.api';
import FilePicker from '../inventory/FilePicker';

const EMPTY = {
  employeeId: '',
  category: '',
  quantity: '1',
  priority: 'MEDIUM',
  needDate: '',
  remarks: '',
};

const FALLBACK = {
  requiredFields: ['employeeId', 'category'],
  productionMode: false,
  categories: ['Laptop', 'Monitor', 'Mouse', 'Keyboard', 'Phone'],
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
    if (need('category') && !form.category) {
      return onSubmit(null, 'Asset category is required');
    }
    if (need('quantity') && !String(form.quantity || '').trim()) {
      return onSubmit(null, 'Quantity is required');
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
    return onSubmit(form, null, { attachments });
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
        If the person is not in Employee Master, add them first. On save the ticket waits for manager approval.
        Approval email is not sent yet.
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
      <label>
        <span>Asset category{star('category')}</span>
        <select value={form.category} onChange={(e) => set('category', e.target.value)} required={need('category')}>
          <option value="">Select category</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Quantity{star('quantity')}</span>
        <input
          type="number"
          min="1"
          max="99"
          value={form.quantity}
          onChange={(e) => set('quantity', e.target.value)}
          required={need('quantity')}
        />
      </label>
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
