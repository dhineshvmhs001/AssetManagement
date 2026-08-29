import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getAsset, updateAsset } from '../../api/assets.api';
import { notify } from '../../ui/notify';
import AssetForm from './AssetForm';

export default function EditAsset() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [asset, setAsset] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getAsset(code).then((data) => {
      if (!data.ok) {
        setError(data.error || 'Asset not found');
        return;
      }
      setAsset(data.asset);
    });
  }, [code]);

  // Asset code and status are shown but not editable, so they are passed
  // through for display only.
  const initial = useMemo(() => {
    if (!asset) {
      return null;
    }
    return {
      assetCode: asset.assetCode,
      statusLabel: asset.statusLabel,
      category: asset.category || 'Laptop',
      brand: asset.brand || '',
      model: asset.model || '',
      serialNumber: asset.serialNumber || '',
      assetType: asset.assetType || 'Own',
      purchaseDate: asset.purchaseDate || '',
      purchaseCost: asset.purchaseCost == null ? '' : String(asset.purchaseCost),
      invoiceNumber: asset.invoiceNumber || '',
      invoiceDate: asset.invoiceDate || '',
      vendor: asset.vendor || '',
      location: asset.location || '',
      condition: asset.condition || 'New',
      warrantyStart: asset.warrantyStart || '',
      warrantyEnd: asset.warrantyEnd || '',
    };
  }, [asset]);

  async function handleSubmit(form, blocked, files) {
    if (blocked) {
      notify.error(blocked);
      return;
    }
    // assetCode and statusLabel are display-only; the API rejects them anyway.
    const editable = { ...form };
    delete editable.assetCode;
    delete editable.statusLabel;
    setBusy(true);
    const data = await updateAsset(code, editable, files);
    setBusy(false);
    if (!data.ok) {
      notify.error(data.error || 'Could not update asset');
      return;
    }
    notify.success(`Asset ${data.asset.assetCode} updated`);
    navigate(`/inventory/${data.asset.assetCode}`);
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
          <h2>Edit {asset.assetCode}</h2>
          <p>Asset code and status cannot be changed here. New files are added to the existing ones.</p>
        </div>
      </div>

      <AssetForm
        initial={initial}
        existingFiles={{ documents: asset.documents || [], images: asset.images || [] }}
        submitLabel="Save changes"
        busy={busy}
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/inventory/${code}`)}
      />
    </section>
  );
}
