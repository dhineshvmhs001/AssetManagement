import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listAssets } from '../../api/assets.api';
import './Dashboard.css';

// PRD 7.1 asks for these seven counts, in this order.
const TILES = [
  { key: '', label: 'Total' },
  { key: 'AVAILABLE', label: 'Available' },
  { key: 'ASSIGNED', label: 'Assigned' },
  { key: 'MAINTENANCE', label: 'Under Maintenance' },
  { key: 'DAMAGED', label: 'Damaged' },
  { key: 'LOST', label: 'Lost' },
  { key: 'RETIRED', label: 'Retired / Disposed' },
];

const EMPTY_COUNTS = { total: 0, byStatus: {} };

export default function Dashboard() {
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const [error, setError] = useState(null);

  // The list endpoint already returns the whole status breakdown, so asking
  // for a single row is enough — no extra endpoint needed for the tiles.
  useEffect(() => {
    listAssets({ limit: 1 }).then((res) => {
      if (res.ok) {
        setCounts(res.counts || EMPTY_COUNTS);
      } else {
        setError(res.error || 'Could not load inventory counts');
      }
    });
  }, []);

  return (
    <section className="dash">
      <div className="dash-head">
        <h2>Dashboard</h2>
        <p>Inventory at a glance. Open a tile to see those assets.</p>
      </div>

      {error && <p className="dash-error">{error}</p>}

      <div className="dash-tiles">
        {TILES.map((tile) => (
          <Link
            key={tile.label}
            className={`dash-tile${tile.key ? ` t-${tile.key.toLowerCase()}` : ''}`}
            to={tile.key ? `/inventory?status=${tile.key}` : '/inventory'}
          >
            <span className="dash-tile-n">
              {tile.key ? counts.byStatus?.[tile.key] ?? 0 : counts.total ?? 0}
            </span>
            <span className="dash-tile-label">{tile.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
