import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getVendor, updateVendor } from '../../api/vendors.api';
import { notify } from '../../ui/notify';
import VendorForm from './VendorForm';

export default function EditVendor() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [vendor, setVendor] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getVendor(code).then((data) => {
      if (!data.ok) {
        setError(data.error || 'Vendor not found');
        return;
      }
      setVendor(data.vendor);
    });
  }, [code]);

  const initial = useMemo(() => {
    if (!vendor) {
      return null;
    }
    return {
      vendorCode: vendor.vendorCode,
      name: vendor.name || '',
      contact: vendor.contact || '',
      email: vendor.email || '',
      mobile: vendor.mobile || '',
      location: vendor.location || '',
      status: vendor.status || 'ACTIVE',
      accountNumber: vendor.accountNumber || '',
      branch: vendor.branch || '',
      ifscCode: vendor.ifscCode || '',
      accountHolderName: vendor.accountHolderName || '',
    };
  }, [vendor]);

  async function handleSubmit(form, blocked, files) {
    if (blocked) {
      notify.error(blocked);
      return;
    }
    const editable = { ...form };
    delete editable.vendorCode;
    setBusy(true);
    const data = await updateVendor(code, editable, files);
    setBusy(false);
    if (!data.ok) {
      notify.error(data.error || 'Could not update vendor');
      return;
    }
    notify.success(`Vendor ${data.vendor.vendorCode} updated`);
    navigate(`/vendors/${data.vendor.vendorCode}`);
  }

  if (error) {
    return <p className="inv-error">{error}</p>;
  }
  if (!initial) {
    return <div className="page-wait" aria-busy="true" />;
  }

  return (
    <section>
      <div className="inv-head">
        <div>
          <h2>Edit {vendor.vendorCode}</h2>
          <p>Vendor ID cannot be changed. New documents are added to the existing ones.</p>
        </div>
      </div>

      <VendorForm
        initial={initial}
        existingFiles={{ documents: vendor.documents || [] }}
        submitLabel="Save changes"
        busy={busy}
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/vendors/${code}`)}
      />
    </section>
  );
}
