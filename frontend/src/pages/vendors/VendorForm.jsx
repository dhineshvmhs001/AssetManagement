import { useEffect, useState } from 'react';
import { setNavGuard, clearNavGuard } from '../../keyboard/navGuard';
import { getVendorOptions } from '../../api/vendors.api';
import FilePicker from '../inventory/FilePicker';

export const EMPTY_VENDOR = {
  name: '',
  contact: '',
  email: '',
  mobile: '',
  location: '',
  status: 'ACTIVE',
  accountNumber: '',
  branch: '',
  ifscCode: '',
  accountHolderName: '',
};

const FALLBACK_OPTIONS = {
  requiredFields: [
    'name',
    'contact',
    'email',
    'mobile',
    'location',
    'status',
    'accountNumber',
    'branch',
    'ifscCode',
    'accountHolderName',
  ],
  productionMode: false,
};

export default function VendorForm({
  initial,
  existingFiles = { documents: [] },
  submitLabel,
  busy,
  onSubmit,
  onCancel,
}) {
  const [options, setOptions] = useState(FALLBACK_OPTIONS);
  const [form, setForm] = useState(initial || EMPTY_VENDOR);
  const [documents, setDocuments] = useState([]);
  const [baseline, setBaseline] = useState(() => JSON.stringify(initial || EMPTY_VENDOR));

  useEffect(() => {
    getVendorOptions().then((res) => {
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

  function star(key) {
    return need(key) ? <span className="inv-req"> *</span> : null;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (need('name') && !String(form.name || '').trim()) {
      return onSubmit(null, 'Vendor / Supplier name is required');
    }
    if (need('contact') && !String(form.contact || '').trim()) {
      return onSubmit(null, 'Contact is required');
    }
    if (need('email') && !String(form.email || '').trim()) {
      return onSubmit(null, 'Email is required');
    }
    if (need('mobile') && !String(form.mobile || '').trim()) {
      return onSubmit(null, 'Mobile is required');
    }
    if (need('location') && !String(form.location || '').trim()) {
      return onSubmit(null, 'Location is required');
    }
    if (need('accountNumber') && !String(form.accountNumber || '').trim()) {
      return onSubmit(null, 'Account number is required');
    }
    if (need('branch') && !String(form.branch || '').trim()) {
      return onSubmit(null, 'Branch is required');
    }
    if (need('ifscCode') && !String(form.ifscCode || '').trim()) {
      return onSubmit(null, 'IFSC code is required');
    }
    if (need('accountHolderName') && !String(form.accountHolderName || '').trim()) {
      return onSubmit(null, 'Account holder name is required');
    }
    if (need('documents') && !documents.length && !existingFiles.documents.length) {
      return onSubmit(null, 'Documents are required');
    }
    return onSubmit(form, null, { documents });
  }

  function leave() {
    if (!dirty || window.confirm('Leave this form? Your unsaved changes will be lost.')) {
      onCancel();
    }
  }

  return (
    <form className="inv-card inv-form" onSubmit={handleSubmit}>
      <p className="inv-note">This vendor is selected on Add Asset and when a repair uses an outside service provider. Name, email, and mobile must each be unique.</p>

      {form.vendorCode ? (
        <label>
          <span>Vendor ID</span>
          <input value={form.vendorCode} disabled />
        </label>
      ) : null}
      <label>
        <span>Vendor / Supplier name{star('name')} <em className="inv-muted">(unique)</em></span>
        <input value={form.name} onChange={(e) => set('name', e.target.value)} required={need('name')} />
      </label>
      <label>
        <span>Contact{star('contact')}</span>
        <input value={form.contact} onChange={(e) => set('contact', e.target.value)} required={need('contact')} />
      </label>
      <label>
        <span>Email{star('email')} <em className="inv-muted">(unique)</em></span>
        <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required={need('email')} />
      </label>
      <label>
        <span>Mobile{star('mobile')} <em className="inv-muted">(unique)</em></span>
        <input value={form.mobile} onChange={(e) => set('mobile', e.target.value)} required={need('mobile')} />
      </label>
      <label>
        <span>Location{star('location')}</span>
        <input value={form.location} onChange={(e) => set('location', e.target.value)} required={need('location')} />
      </label>
      <label>
        <span>Status{star('status')}</span>
        <select value={form.status} onChange={(e) => set('status', e.target.value)} required={need('status')}>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </label>

      <p className="inv-note">Bank details. All four fields are required.</p>
      <label>
        <span>Account number{star('accountNumber')}</span>
        <input
          value={form.accountNumber}
          onChange={(e) => set('accountNumber', e.target.value)}
          inputMode="numeric"
          autoComplete="off"
          required={need('accountNumber')}
        />
      </label>
      <label>
        <span>Branch{star('branch')}</span>
        <input value={form.branch} onChange={(e) => set('branch', e.target.value)} required={need('branch')} />
      </label>
      <label>
        <span>IFSC code{star('ifscCode')}</span>
        <input
          value={form.ifscCode}
          onChange={(e) => set('ifscCode', e.target.value.toUpperCase())}
          autoComplete="off"
          required={need('ifscCode')}
        />
      </label>
      <label>
        <span>Account holder name{star('accountHolderName')}</span>
        <input
          value={form.accountHolderName}
          onChange={(e) => set('accountHolderName', e.target.value)}
          required={need('accountHolderName')}
        />
      </label>

      <FilePicker
        label="Documents"
        hint="Agreements, purchase docs. PDF, Word, or image. Up to 8 files, 8 MB each."
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
