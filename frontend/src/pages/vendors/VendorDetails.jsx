import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getVendor, getVendorFileUrl } from '../../api/vendors.api';

export default function VendorDetails() {
  const { code } = useParams();
  const [vendor, setVendor] = useState(null);
  const [error, setError] = useState(null);
  const [fileUrls, setFileUrls] = useState({});

  useEffect(() => {
    getVendor(code).then((data) => {
      if (!data.ok) {
        setError(data.error || 'Vendor not found');
        return;
      }
      setVendor(data.vendor);
    });
  }, [code]);

  useEffect(() => {
    if (!vendor) {
      return undefined;
    }
    const paths = (vendor.documents || []).map((file) => file.path).filter(Boolean);
    if (!paths.length) {
      return undefined;
    }

    let live = true;
    const made = [];
    Promise.all(
      paths.map((path) => getVendorFileUrl(path).then((url) => {
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
  }, [vendor]);

  if (error) {
    return <p className="inv-error">{error}</p>;
  }
  if (!vendor) {
    return <p className="inv-muted">Loading…</p>;
  }

  return (
    <section>
      <div className="inv-head">
        <div>
          <h2>
            {vendor.vendorCode} · {vendor.name}
          </h2>
          <p>Supplier record used on incoming stock.</p>
        </div>
        <div className="inv-head-actions">
          <Link className="btn ghost" to={`/vendors/${vendor.vendorCode}/edit`}>
            Edit
          </Link>
          <Link className="btn primary" to={`/inventory/add?vendor=${encodeURIComponent(vendor.name)}`}>
            Add asset from this vendor
          </Link>
        </div>
      </div>

      <div className="inv-card">
        <h3>Profile</h3>
        <dl className="inv-meta">
          <div>
            <dt>Vendor ID</dt>
            <dd>{vendor.vendorCode}</dd>
          </div>
          <div>
            <dt>Name</dt>
            <dd>{vendor.name}</dd>
          </div>
          <div>
            <dt>Contact</dt>
            <dd>{vendor.contact || '—'}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{vendor.email || '—'}</dd>
          </div>
          <div>
            <dt>Mobile</dt>
            <dd>{vendor.mobile || '—'}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{vendor.location || '—'}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <span className={`st st-${vendor.status.toLowerCase()}`}>{vendor.statusLabel}</span>
            </dd>
          </div>
          <div>
            <dt>Account number</dt>
            <dd>{vendor.accountNumber || '—'}</dd>
          </div>
          <div>
            <dt>Branch</dt>
            <dd>{vendor.branch || '—'}</dd>
          </div>
          <div>
            <dt>IFSC code</dt>
            <dd>{vendor.ifscCode || '—'}</dd>
          </div>
          <div>
            <dt>Account holder name</dt>
            <dd>{vendor.accountHolderName || '—'}</dd>
          </div>
          <div>
            <dt>Assets from this vendor</dt>
            <dd>{vendor.assetCount ?? 0}</dd>
          </div>
          <div>
            <dt>Documents</dt>
            <dd>
              {vendor.documents?.length ? (
                <ul className="inv-file-links">
                  {vendor.documents.map((file) => (
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
            <dt>Created by</dt>
            <dd>{vendor.createdBy || '—'}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
