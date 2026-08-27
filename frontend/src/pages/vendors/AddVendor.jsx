import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createVendor } from '../../api/vendors.api';
import { notify } from '../../ui/notify';
import VendorForm from './VendorForm';

export default function AddVendor() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function handleSubmit(form, blocked, files) {
    if (blocked) {
      notify.error(blocked);
      return;
    }
    setBusy(true);
    const data = await createVendor(form, files);
    setBusy(false);
    if (!data.ok) {
      notify.error(data.error || 'Could not save vendor');
      return;
    }
    notify.success(`Vendor ${data.vendor.vendorCode} saved`);
    navigate(`/vendors/${data.vendor.vendorCode}`);
  }

  return (
    <section>
      <div className="inv-head">
        <div>
          <h2>Add vendor</h2>
          <p>Fill the supplier details. A Vendor ID (VEN-001, VEN-002…) is created automatically on save.</p>
        </div>
      </div>

      <VendorForm
        submitLabel="Save vendor"
        busy={busy}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/vendors')}
      />
    </section>
  );
}
