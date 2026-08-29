import { useEffect, useState } from 'react';
import { setNavGuard, clearNavGuard } from '../../keyboard/navGuard';
import { getEmployeeOptions } from '../../api/employees.api';
import FilePicker from '../inventory/FilePicker';
import { Field, Input, Select } from '../../ui';

export const EMPTY_EMPLOYEE = {
  employeeCode: '',
  name: '',
  department: '',
  designation: '',
  email: '',
  mobile: '',
  joiningDate: '',
  managerId: '',
  location: '',
  status: 'ACTIVE',
};

const FALLBACK_OPTIONS = {
  requiredFields: ['name'],
  productionMode: false,
  departments: ['Sales', 'Operations', 'Support', 'HR'],
  managers: [],
};

export default function EmployeeForm({
  initial,
  existingFiles = { documents: [] },
  submitLabel,
  busy,
  onSubmit,
  onCancel,
}) {
  const [options, setOptions] = useState(FALLBACK_OPTIONS);
  const [form, setForm] = useState(initial || EMPTY_EMPLOYEE);
  const [documents, setDocuments] = useState([]);
  const [baseline, setBaseline] = useState(() => JSON.stringify(initial || EMPTY_EMPLOYEE));

  useEffect(() => {
    getEmployeeOptions().then((res) => {
      if (res.ok) {
        setOptions(res);
      }
    });
  }, []);

  useEffect(() => {
    if (!initial) {
      return;
    }
    setForm(initial);
    setBaseline(JSON.stringify(initial));
  }, [initial]);

  const dirty = JSON.stringify(form) !== baseline || documents.length > 0;

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

  const managerChoices = options.managers || [];
  const departments = options.departments || FALLBACK_OPTIONS.departments;
  const idLocked = Boolean(initial?.employeeCode);

  function handleSubmit(e) {
    e.preventDefault();
    if (!idLocked) {
      const code = String(form.employeeCode || '').trim();
      if (!code) {
        return onSubmit(null, 'Employee ID is required');
      }
      if (!/^MHS[0-9]+$/i.test(code)) {
        return onSubmit(null, 'Employee ID must be MHS followed by numbers, like MHS101 (no spaces or dashes)');
      }
    }
    if (need('name') && !String(form.name || '').trim()) {
      return onSubmit(null, 'Name is required');
    }
    if (need('department') && !String(form.department || '').trim()) {
      return onSubmit(null, 'Department is required');
    }
    if (need('designation') && !String(form.designation || '').trim()) {
      return onSubmit(null, 'Designation is required');
    }
    if (need('email') && !String(form.email || '').trim()) {
      return onSubmit(null, 'Email is required');
    }
    if (need('mobile') && !String(form.mobile || '').trim()) {
      return onSubmit(null, 'Mobile is required');
    }
    if (need('joiningDate') && !String(form.joiningDate || '').trim()) {
      return onSubmit(null, 'Joining date is required');
    }
    if (need('location') && !String(form.location || '').trim()) {
      return onSubmit(null, 'Location is required');
    }
    if (need('managerId') && !String(form.managerId || '').trim()) {
      return onSubmit(null, 'Manager is required');
    }
    if (need('documents') && !documents.length && !existingFiles.documents.length) {
      return onSubmit(null, 'Documents are required');
    }
    return onSubmit(
      idLocked ? form : { ...form, employeeCode: String(form.employeeCode || '').trim().toUpperCase() },
      null,
      { documents },
    );
  }

  function leave() {
    if (!dirty || window.confirm('Leave this form? Your unsaved changes will be lost.')) {
      onCancel();
    }
  }

  return (
    <form className="inv-card inv-form" onSubmit={handleSubmit}>
      <p className="inv-note">
        Used when HR raises a ticket and when an asset is assigned. Employee ID is MHS plus numbers
        (example MHS101). It is stored in capitals. Email and mobile must each be unique.
        Manager is picked from the managers list (users with the Manager role). Required when PRODUCTION_MODE is on.
      </p>

      <Field label="Employee ID" required={!idLocked}>
        <Input
          value={form.employeeCode || ''}
          onChange={idLocked ? undefined : (e) => set('employeeCode', e.target.value)}
          onBlur={
            idLocked
              ? undefined
              : (e) => set('employeeCode', String(e.target.value || '').trim().toUpperCase())
          }
          placeholder="MHS101"
          disabled={idLocked}
          required={!idLocked}
        />
      </Field>
      <Field label="Name" required={need('name')}>
        <Input value={form.name} onChange={(e) => set('name', e.target.value)} required={need('name')} />
      </Field>
      <Field label="Department" required={need('department')}>
        <Select value={form.department} onChange={(e) => set('department', e.target.value)} aria-label="Department">
          <option value="">Select department</option>
          {departments.map((dept) => (
            <option key={dept} value={dept}>
              {dept}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Designation" required={need('designation')}>
        <Input value={form.designation} onChange={(e) => set('designation', e.target.value)} required={need('designation')} />
      </Field>
      <Field label="Email" required={need('email')} hint="Must be unique">
        <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required={need('email')} />
      </Field>
      <Field label="Mobile" required={need('mobile')} hint="Must be unique">
        <Input value={form.mobile} onChange={(e) => set('mobile', e.target.value)} required={need('mobile')} />
      </Field>
      <Field label="Joining date" required={need('joiningDate')}>
        <Input type="date" value={form.joiningDate} onChange={(e) => set('joiningDate', e.target.value)} required={need('joiningDate')} />
      </Field>
      <Field label="Manager" required={need('managerId')}>
        <Select
          value={form.managerId || ''}
          onChange={(e) => set('managerId', e.target.value)}
          aria-label="Manager"
        >
          <option value="">{managerChoices.length ? 'Select manager' : 'No managers in the list yet'}</option>
          {managerChoices.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name} — {person.email}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Location" required={need('location')}>
        <Input value={form.location} onChange={(e) => set('location', e.target.value)} required={need('location')} />
      </Field>
      <Field label="Status" required={need('status')}>
        <Select value={form.status} onChange={(e) => set('status', e.target.value)} aria-label="Status">
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </Select>
      </Field>

      <FilePicker
        label="Documents"
        hint="Offer letter, ID proof. PDF, Word, or image. Up to 8 files, 8 MB each."
        accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp,image/gif"
        files={documents}
        onChange={setDocuments}
        required={need('documents')}
        alreadyStored={existingFiles.documents.length}
        wide
      />

      <div className="inv-form-actions">
        <button type="button" className="btn ghost" onClick={leave}>
          Cancel
        </button>
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
