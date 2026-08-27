import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAssetOptions } from '../../api/assets.api';
import { listVendors } from '../../api/vendors.api';
import { setNavGuard, clearNavGuard } from '../../keyboard/navGuard';
import FilePicker from './FilePicker';

export const EMPTY_ASSET = {
  category: 'Laptop',
  brand: '',
  model: '',
  serialNumber: '',
  assetType: 'Own',
  purchaseDate: '',
  purchaseCost: '',
  invoiceNumber: '',
  invoiceDate: '',
  vendor: '',
  location: '',
  condition: 'New',
  warrantyStart: '',
  warrantyEnd: '',
};

const FALLBACK_OPTIONS = {
  categories: ['Laptop'],
  conditions: ['New'],
  assetTypes: ['Own'],
  requiredFields: ['category', 'brand', 'serialNumber'],
  productionMode: false,
};

// Shared by Add asset and Edit asset. `existingFiles` are the ones already
// stored against the asset; they count toward a required Documents/Images.
export default function AssetForm({
  initial,
  existingFiles = { documents: [], images: [] },
  submitLabel,
  busy,
  onSubmit,
  onCancel,
}) {
  const [options, setOptions] = useState(FALLBACK_OPTIONS);
  const [vendors, setVendors] = useState([]);
  const [form, setForm] = useState(initial || EMPTY_ASSET);
  const [documents, setDocuments] = useState([]);
  const [images, setImages] = useState([]);
  const [baseline, setBaseline] = useState(() => JSON.stringify(initial || EMPTY_ASSET));

  useEffect(() => {
    getAssetOptions().then((res) => {
      if (res.ok) {
        setOptions(res);
      }
    });
    listVendors({ status: 'ACTIVE', limit: 200 }).then((res) => {
      if (res.ok) {
        setVendors(res.vendors || []);
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

  // Warn before a keyboard shortcut or a browser reload throws away edits.
  const dirty =
    JSON.stringify(form) !== baseline || documents.length > 0 || images.length > 0;

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
    if (need('documents') && !documents.length && !existingFiles.documents.length) {
      return onSubmit(null, 'Documents are required');
    }
    if (need('images') && !images.length && !existingFiles.images.length) {
      return onSubmit(null, 'Images are required');
    }
    return onSubmit(form, null, { documents, images });
  }

  function leave() {
    if (!dirty || window.confirm('Leave this form? Your unsaved changes will be lost.')) {
      onCancel();
    }
  }

  return (
    <form className="inv-card inv-form" onSubmit={handleSubmit}>
      <p className="inv-note">After save, a QR / printable sticker is generated for the physical item.</p>

      {form.assetCode ? (
        <label>
          <span>Asset code</span>
          <input value={form.assetCode} disabled />
        </label>
      ) : null}
      <label>
        <span>Category{star('category')}</span>
        <select value={form.category} onChange={(e) => set('category', e.target.value)} required={need('category')}>
          {options.categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Brand{star('brand')}</span>
        <input value={form.brand} onChange={(e) => set('brand', e.target.value)} required={need('brand')} />
      </label>
      <label>
        <span>Model{star('model')}</span>
        <input value={form.model} onChange={(e) => set('model', e.target.value)} required={need('model')} />
      </label>
      <label>
        <span>Serial number{star('serialNumber')}</span>
        <input
          value={form.serialNumber}
          onChange={(e) => set('serialNumber', e.target.value)}
          required={need('serialNumber')}
        />
      </label>
      <label>
        <span>Asset type{star('assetType')}</span>
        <select value={form.assetType} onChange={(e) => set('assetType', e.target.value)} required={need('assetType')}>
          {options.assetTypes.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Purchase date{star('purchaseDate')}</span>
        <input
          type="date"
          value={form.purchaseDate}
          onChange={(e) => set('purchaseDate', e.target.value)}
          required={need('purchaseDate')}
        />
      </label>
      <label>
        <span>Purchase cost{star('purchaseCost')}</span>
        <input
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          placeholder="20000"
          value={form.purchaseCost}
          onChange={(e) => set('purchaseCost', e.target.value)}
          required={need('purchaseCost')}
        />
      </label>
      <label>
        <span>Invoice number{star('invoiceNumber')}</span>
        <input
          value={form.invoiceNumber}
          onChange={(e) => set('invoiceNumber', e.target.value)}
          required={need('invoiceNumber')}
        />
      </label>
      <label>
        <span>Invoice date{star('invoiceDate')}</span>
        <input
          type="date"
          value={form.invoiceDate}
          onChange={(e) => set('invoiceDate', e.target.value)}
          required={need('invoiceDate')}
        />
      </label>
      <label>
        <span>Vendor{star('vendor')}</span>
        <select value={form.vendor} onChange={(e) => set('vendor', e.target.value)} required={need('vendor')}>
          <option value="">{vendors.length ? 'Select vendor' : 'Add a vendor first'}</option>
          {vendors.map((vendor) => (
            <option key={vendor.id} value={vendor.name}>
              {vendor.vendorCode} — {vendor.name}
            </option>
          ))}
          {form.vendor && !vendors.some((vendor) => vendor.name === form.vendor) ? (
            <option value={form.vendor}>{form.vendor}</option>
          ) : null}
        </select>
      </label>
      {!vendors.length ? (
        <p className="inv-note">
          <Link to="/vendors/add">Add vendor</Link> first, then incoming stock can pick it.
        </p>
      ) : null}
      <label>
        <span>Location{star('location')}</span>
        <input value={form.location} onChange={(e) => set('location', e.target.value)} required={need('location')} />
      </label>
      <label>
        <span>Condition{star('condition')}</span>
        <select value={form.condition} onChange={(e) => set('condition', e.target.value)} required={need('condition')}>
          {options.conditions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      {form.assetCode ? (
        <label>
          <span>Status</span>
          <input value={form.statusLabel || 'Available'} disabled />
        </label>
      ) : null}
      <label>
        <span>Warranty start{star('warrantyStart')}</span>
        <input
          type="date"
          value={form.warrantyStart}
          onChange={(e) => set('warrantyStart', e.target.value)}
          required={need('warrantyStart')}
        />
      </label>
      <label>
        <span>Warranty end{star('warrantyEnd')}</span>
        <input
          type="date"
          value={form.warrantyEnd}
          onChange={(e) => set('warrantyEnd', e.target.value)}
          required={need('warrantyEnd')}
        />
      </label>

      <FilePicker
        label="Documents"
        hint="PDF, Word, or image. Up to 8 files, 8 MB each."
        accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp,image/gif"
        files={documents}
        onChange={setDocuments}
        required={need('documents')}
        alreadyStored={existingFiles.documents.length}
      />
      <FilePicker
        label="Images"
        hint="JPG, PNG, WebP, or GIF. Up to 8 files, 8 MB each."
        accept="image/jpeg,image/png,image/webp,image/gif"
        files={images}
        onChange={setImages}
        showPreview
        required={need('images')}
        alreadyStored={existingFiles.images.length}
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
