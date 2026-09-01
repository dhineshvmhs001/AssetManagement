import { formatDateTime } from '../../ui';

export default function ActivityHistory({ entries, empty = 'No history recorded yet.' }) {
  if (!entries?.length) {
    return <p className="inv-muted">{empty}</p>;
  }
  return (
    <ul className="inv-history">
      {entries.map((entry) => (
        <li key={entry.id}>
          <div className="inv-history-top">
            <span className="inv-history-action">{entry.actionLabel || String(entry.action || '').replaceAll('_', ' ')}</span>
            <span className="inv-muted">{formatDateTime(entry.at)}</span>
          </div>
          <p>{entry.description || '—'}</p>
          <p className="inv-muted">
            {entry.module} · {entry.by}
            {entry.role ? ` (${entry.role})` : ''}
          </p>
        </li>
      ))}
    </ul>
  );
}
