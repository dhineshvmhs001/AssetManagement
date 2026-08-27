import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createAsset } from '../../api/assets.api';
import { notify } from '../../ui/notify';
import AssetForm, { EMPTY_ASSET } from './AssetForm';

export default function AddAsset() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const presetVendor = searchParams.get('vendor') || '';

  async function handleSubmit(form, blocked, files) {
    if (blocked) {
      notify.error(blocked);
      return;
    }
    setBusy(true);
    const data = await createAsset(form, files);
    setBusy(false);
    if (!data.ok) {
      notify.error(data.error || 'Could not save asset');
      return;
    }
    notify.success(`Asset ${data.asset.assetCode} saved`, 'Opening the QR sticker to print.');
    navigate(`/inventory/${data.asset.assetCode}/sticker`);
  }

  return (
    <section>
      <div className="inv-head">
        <div>
          <h2>Add asset</h2>
          <p>Asset code is generated as Category + Brand + Sequence. Example: LP-DL-0001.</p>
        </div>
      </div>

      <AssetForm
        initial={presetVendor ? { ...EMPTY_ASSET, vendor: presetVendor } : undefined}
        submitLabel="Save and print sticker"
        busy={busy}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/inventory')}
      />
    </section>
  );
}
