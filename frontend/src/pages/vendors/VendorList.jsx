import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listVendors } from '../../api/vendors.api';

const EMPTY = { search: '', status: '' };
const PAGE_SIZE = 20;

const COLUMNS = [
  { key: 'vendorCode', label: 'Vendor ID' },
  { key: 'name', label: 'Name' },
  { key: 'contact', label: 'Contact' },
  { key: 'email', label: 'Email' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'location', label: 'Location' },
  { key: 'status', label: 'Status' },
  { key: 'assetCount', label: 'Assets' },
];

const EMPTY_DATA = { vendors: [], total: 0, page: 1, pages: 1 };

export default function VendorList() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(EMPTY_DATA);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    listVendors({ ...filters, page, limit: PAGE_SIZE }).then((res) => {
      if (res.ok) {
        setData(res);
        setSelected(0);
      }
    });
  }, [filters.search, filters.status, page]);

  function set(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  const pages = data.pages || 1;
  const from = data.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, data.total);

  return (
    <section>
      <div className="inv-head">
        <div>
          <h2>Vendor list</h2>
          <p>Add the supplier first. Incoming stock on Add Asset picks from this list.</p>
        </div>
        <Link className="btn primary" to="/vendors/add" tabIndex={-1}>
          Add vendor
        </Link>
      </div>

      <div className="inv-toolbar">
        <input
          className="inv-search"
          placeholder="Search vendor ID, name, contact, email…"
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
        />
        <select value={filters.status} onChange={(e) => set('status', e.target.value)}>
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      <div className="inv-table-wrap">
        <table className="inv-table">
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.vendors.map((vendor, index) => (
              <tr
                key={vendor.id}
                className={index === selected ? 'is-selected' : undefined}
                onClick={() => setSelected(index)}
                onDoubleClick={() => navigate(`/vendors/${vendor.vendorCode}`)}
              >
                <td>
                  <Link to={`/vendors/${vendor.vendorCode}`} tabIndex={-1}>
                    {vendor.vendorCode}
                  </Link>
                </td>
                <td>{vendor.name}</td>
                <td>{vendor.contact || '—'}</td>
                <td>{vendor.email || '—'}</td>
                <td>{vendor.mobile || '—'}</td>
                <td>{vendor.location || '—'}</td>
                <td>
                  <span className={`st st-${vendor.status.toLowerCase()}`}>{vendor.statusLabel}</span>
                </td>
                <td>{vendor.assetCount ?? 0}</td>
              </tr>
            ))}
            {!data.vendors.length && (
              <tr>
                <td colSpan={COLUMNS.length} className="inv-empty">
                  No vendors yet. Add one before incoming stock.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="inv-pager">
        <p className="inv-count">
          {data.total ? `${from}–${to} of ${data.total} vendors` : '0 vendors'}
        </p>
        <div className="inv-pager-btns">
          <button type="button" className="btn ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </button>
          <span className="inv-muted">
            Page {page} of {pages}
          </span>
          <button type="button" className="btn ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
