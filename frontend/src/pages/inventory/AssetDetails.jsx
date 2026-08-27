import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getAsset, getAssetFileUrl, getAssetHistory } from '../../api/assets.api';

export default function AssetDetails() {
  const { code } = useParams();
  const [asset, setAsset] = useState(null);
  const [error, setError] = useState(null);
  const [fileUrls, setFileUrls] = useState({});
  const [history, setHistory] = useState([]);

  useEffect(() => {
    getAsset(code).then((data) => {
      if (!data.ok) {
        setError(data.error || 'Asset not found');
        return;
      }
      setAsset(data.asset);
    });
  }, [code]);

  // History is a second request on purpose: a missing or slow log should not
  // stop the profile above from rendering.
  useEffect(() => {
    getAssetHistory(code).then((data) => {
      setHistory(data.ok ? data.history : []);
    });
  }, [code]);

  // Files need the auth header, so each one is fetched into a blob URL.
  useEffect(() => {
    if (!asset) {
      return undefined;
    }
    const paths = [...(asset.documents || []), ...(asset.images || [])]
      .map((file) => file.path)
      .filter(Boolean);
    if (!paths.length) {
      return undefined;
    }

    let live = true;
    const made = [];
    Promise.all(
      paths.map((path) => getAssetFileUrl(path).then((url) => {
        if (url) {
          made.push(url);
        }
        return [path, url];
      })),
    ).then((pairs) => {
      if (live) {
        setFileUrls(Object.fromEntries(pairs.filter(([, url]) => url)));
      }
    });

    return () => {
      live = false;
      made.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [asset]);

  if (error) {
    return <p className="inv-error">{error}</p>;
  }
  if (!asset) {
    return <p className="inv-muted">Loading…</p>;
  }

  return (
    <section>
      <div className="inv-head">
        <div>
          <h2>
            {asset.assetCode} · {asset.brand} {asset.model}
          </h2>
          <p>Profile, status, and sticker reprint.</p>
        </div>
        <div className="inv-head-actions">
          <Link className="btn ghost" to={`/inventory/${asset.assetCode}/edit`}>
            Edit
          </Link>
          <Link className="btn primary" to={`/inventory/${asset.assetCode}/sticker`}>
            Print QR / sticker
          </Link>
        </div>
      </div>

      <div className="inv-card">
        <h3>Profile</h3>
        <dl className="inv-meta">
          <div>
            <dt>Asset code</dt>
            <dd>{asset.assetCode}</dd>
          </div>
          <div>
            <dt>Category / Brand</dt>
            <dd>
              {asset.category} · {asset.brand}
            </dd>
          </div>
          <div>
            <dt>Model / Serial</dt>
            <dd>
              {asset.model || '—'} · {asset.serialNumber}
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <span className={`st st-${asset.status.toLowerCase()}`}>{asset.statusLabel}</span>
            </dd>
          </div>
          <div>
            <dt>Employee</dt>
            <dd>{asset.employeeName || '—'}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{asset.location || '—'}</dd>
          </div>
          <div>
            <dt>Condition</dt>
            <dd>{asset.condition || '—'}</dd>
          </div>
          <div>
            <dt>Vendor</dt>
            <dd>{asset.vendor || '—'}</dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{asset.assetType}</dd>
          </div>
          <div>
            <dt>Purchase</dt>
            <dd>
              {asset.purchaseDate || '—'} · {asset.purchaseCost || '—'}
            </dd>
          </div>
          <div>
            <dt>Invoice</dt>
            <dd>
              {asset.invoiceNumber || '—'} · {asset.invoiceDate || '—'}
            </dd>
          </div>
          <div>
            <dt>Warranty</dt>
            <dd>
              {asset.warrantyStart || '—'} to {asset.warrantyEnd || '—'}
            </dd>
          </div>
          <div>
            <dt>Documents</dt>
            <dd>
              {asset.documents?.length ? (
                <ul className="inv-file-links">
                  {asset.documents.map((file) => (
                    <li key={file.stored || file.name}>
                      {fileUrls[file.path] ? (
                        <a href={fileUrls[file.path]} target="_blank" rel="noreferrer">
                          {file.name}
                        </a>
                      ) : (
                        file.name
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>
              {asset.createdBy || '—'} · {asset.createdAt ? new Date(asset.createdAt).toLocaleString() : '—'}
            </dd>
          </div>
        </dl>
      </div>

      <div className="inv-card" style={{ marginTop: 14 }}>
        <h3>History</h3>
        {history.length ? (
          <ul className="inv-history">
            {history.map((entry) => (
              <li key={entry.id}>
                <div className="inv-history-top">
                  <span className="inv-history-action">{entry.action.replaceAll('_', ' ')}</span>
                  <span className="inv-muted">{new Date(entry.at).toLocaleString()}</span>
                </div>
                <p>{entry.description || '—'}</p>
                <p className="inv-muted">
                  {entry.module} · {entry.by}
                  {entry.role ? ` (${entry.role})` : ''}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="inv-muted">No history recorded for this asset yet.</p>
        )}
      </div>

      {!!asset.images?.length && (
        <div className="inv-card" style={{ marginTop: 14 }}>
          <h3>Images</h3>
          <div className="inv-gallery">
            {asset.images.map((file) =>
              fileUrls[file.path] ? (
                <a key={file.stored || file.name} href={fileUrls[file.path]} target="_blank" rel="noreferrer">
                  <img src={fileUrls[file.path]} alt={file.name} />
                </a>
              ) : (
                <span key={file.stored || file.name}>{file.name}</span>
              ),
            )}
          </div>
        </div>
      )}
    </section>
  );
}
