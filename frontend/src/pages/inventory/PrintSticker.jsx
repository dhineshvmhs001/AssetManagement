import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getAssetQr } from '../../api/assets.api';

export default function PrintSticker() {
  const { code } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getAssetQr(code).then((res) => {
      if (!res.ok) {
        setError(res.error || 'Asset not found');
        return;
      }
      setData(res);
    });
  }, [code]);

  if (error) {
    return <p className="inv-error">{error}</p>;
  }
  if (!data) {
    return <div className="page-wait" aria-busy="true" />;
  }

  const asset = data.asset;

  return (
    <section>
      <div className="inv-head">
        <div>
          <h2>Print QR / sticker</h2>
          <p>Print and place on the physical item. Scan later to open this asset.</p>
        </div>
        <button type="button" className="btn primary" onClick={() => window.print()}>
          Print
        </button>
      </div>

      <div className="inv-sticker-wrap">
        <div className="inv-sticker">
          <div className="inv-sticker-kicker">Asset Management</div>
          <img src={data.qr} alt={`QR for ${asset.assetCode}`} />
          <div className="inv-sticker-code">{asset.assetCode}</div>
          <div>Category: {asset.category}</div>
          <div>Serial: {asset.serialNumber}</div>
          <div>
            {asset.brand} {asset.model}
          </div>
        </div>
        <div className="inv-card" style={{ flex: 1 }}>
          <h3>Sticker contents</h3>
          <dl className="inv-meta">
            <div>
              <dt>Asset code</dt>
              <dd>{asset.assetCode}</dd>
            </div>
            <div>
              <dt>Serial number</dt>
              <dd>{asset.serialNumber}</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{asset.category}</dd>
            </div>
            <div>
              <dt>Scan</dt>
              <dd>QR encodes asset:{asset.assetCode}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
