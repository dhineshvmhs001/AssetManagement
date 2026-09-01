import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAssetOptions } from '../../api/assets.api';
import { listVendors } from '../../api/vendors.api';
import { setNavGuard, clearNavGuard } from '../../keyboard/navGuard';
import FilePicker from './FilePicker';
import { DatePicker, Field, Input, istDay, Select, SectionTitle } from '../../ui';

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
  brandsByCategory: {},
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
    setForm((prev) => {
      if (key !== 'category') {
        return { ...prev, [key]: value };
      }
      const brands = (options.brandsByCategory || {})[value] || [];
      const keep = brands.some((brand) => brand.toLowerCase() === String(prev.brand || '').trim().toLowerCase());
      return { ...prev, category: value, brand: keep ? prev.brand : '' };
    });
  }

  function need(key) {
    return (options.requiredFields || []).includes(key);
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

  const categoryBrands = (options.brandsByCategory || {})[form.category] || [];
  const brandChoices =
    form.brand && !categoryBrands.some((brand) => brand.toLowerCase() === form.brand.trim().toLowerCase())
      ? [form.brand, ...categoryBrands]
      : categoryBrands;
  const brandListId = `asset-brands-${String(form.category || 'all').replace(/\s+/g, '-')}`;

  return (
    <form className="inv-card inv-form" onSubmit={handleSubmit}>
      <p className="inv-note">After save, a QR / printable sticker is generated for the physical item.</p>

      <SectionTitle>Identity</SectionTitle>
      {form.assetCode ? (
        <Field label="Asset code">
          <Input value={form.assetCode} disabled />
        </Field>
      ) : null}
      <Field label="Category" required={need('category')}>
        <Select value={form.category} onChange={(e) => set('category', e.target.value)} aria-label="Category">
          {options.categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label="Brand"
        required={need('brand')}
        hint={brandChoices.length ? 'Pick a brand used in this category, or type a new one.' : 'Type the brand.'}
      >
        <Input
          value={form.brand}
          list={brandListId}
          onChange={(e) => set('brand', e.target.value)}
          required={need('brand')}
          autoComplete="off"
          aria-label="Brand"
        />
        <datalist id={brandListId}>
          {brandChoices.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      </Field>
      <Field label="Model" required={need('model')}>
        <Input value={form.model} onChange={(e) => set('model', e.target.value)} required={need('model')} />
      </Field>
      <Field label="Serial number" required={need('serialNumber')}>
        <Input
          value={form.serialNumber}
          onChange={(e) => set('serialNumber', e.target.value)}
          required={need('serialNumber')}
        />
      </Field>
      <Field label="Asset type" required={need('assetType')}>
        <Select value={form.assetType} onChange={(e) => set('assetType', e.target.value)} aria-label="Asset type">
          {options.assetTypes.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Location" required={need('location')}>
        <Input value={form.location} onChange={(e) => set('location', e.target.value)} required={need('location')} />
      </Field>
      <Field label="Condition" required={need('condition')}>
        <Select value={form.condition} onChange={(e) => set('condition', e.target.value)} aria-label="Condition">
          {options.conditions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
      </Field>
      {form.assetCode ? (
        <Field label="Status">
          <Input value={form.statusLabel || 'Available'} disabled />
        </Field>
      ) : null}

      <SectionTitle>Purchase</SectionTitle>
      <Field label="Purchase date" required={need('purchaseDate')}>
        <DatePicker
          value={form.purchaseDate}
          onChange={(value) => set('purchaseDate', value)}
          max={istDay()}
          required={need('purchaseDate')}
          aria-label="Purchase date"
        />
      </Field>
      <Field label="Purchase cost" required={need('purchaseCost')}>
        <Input
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          placeholder="20000"
          value={form.purchaseCost}
          onChange={(e) => set('purchaseCost', e.target.value)}
          required={need('purchaseCost')}
        />
      </Field>
      <Field label="Invoice number" required={need('invoiceNumber')}>
        <Input
          value={form.invoiceNumber}
          onChange={(e) => set('invoiceNumber', e.target.value)}
          required={need('invoiceNumber')}
        />
      </Field>
      <Field label="Invoice date" required={need('invoiceDate')}>
        <DatePicker
          value={form.invoiceDate}
          onChange={(value) => set('invoiceDate', value)}
          min={form.purchaseDate || undefined}
          max={istDay()}
          required={need('invoiceDate')}
          aria-label="Invoice date"
        />
      </Field>
      <Field label="Vendor" required={need('vendor')}>
        <Select value={form.vendor} onChange={(e) => set('vendor', e.target.value)} aria-label="Vendor">
          <option value="">{vendors.length ? 'Select vendor' : 'Add a vendor first'}</option>
          {vendors.map((vendor) => (
            <option key={vendor.id} value={vendor.name}>
              {vendor.vendorCode} — {vendor.name}
            </option>
          ))}
          {form.vendor && !vendors.some((vendor) => vendor.name === form.vendor) ? (
            <option value={form.vendor}>{form.vendor}</option>
          ) : null}
        </Select>
      </Field>
      {!vendors.length ? (
        <p className="inv-note">
          <Link to="/vendors/add">Add vendor</Link> first, then incoming stock can pick it.
        </p>
      ) : null}

      <SectionTitle>Warranty</SectionTitle>
      <Field label="Warranty start" required={need('warrantyStart')}>
        <DatePicker
          value={form.warrantyStart}
          onChange={(value) => set('warrantyStart', value)}
          max={form.warrantyEnd || undefined}
          required={need('warrantyStart')}
          aria-label="Warranty start"
        />
      </Field>
      <Field label="Warranty end" required={need('warrantyEnd')}>
        <DatePicker
          value={form.warrantyEnd}
          onChange={(value) => set('warrantyEnd', value)}
          min={form.warrantyStart || undefined}
          required={need('warrantyEnd')}
          aria-label="Warranty end"
        />
      </Field>

      <SectionTitle>Files</SectionTitle>
      <FilePicker
        label="Documents"
        hint="PDF, Word, or image. Up to 8 files, 8 MB each."
        accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp,image/gif"
        files={documents}
        onChange={setDocuments}
        required={need('documents')}
        alreadyStored={existingFiles.documents.length}
        wide
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
