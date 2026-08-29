import './Pill.css';
import { priorityTone, roleTone, statusLabel, statusTone } from './status';

/** Generic chip. Pass a tone, or bg/color for a one-off. */
export function Pill({ tone, bg, color, upper = false, className = '', style, children }) {
  const classes = [
    'ds-pill',
    tone ? `ds-tone-${tone}` : '',
    upper ? 'ds-pill--upper' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={classes} style={{ background: bg, color, ...style }}>
      {children}
    </span>
  );
}

/** Dot + uppercase label, coloured from the central status map. */
export function StatusPill({ status, label, className = '' }) {
  const text = label || statusLabel(status);
  if (!text) {
    return <span className="ds-empty-value">—</span>;
  }
  return (
    <Pill tone={statusTone(status)} upper className={className}>
      <span className="ds-pill__dot" />
      {text}
    </Pill>
  );
}

export function RoleBadge({ role }) {
  return role ? (
    <Pill tone={roleTone(role)} upper>
      {statusLabel(role)}
    </Pill>
  ) : (
    <span className="ds-empty-value">—</span>
  );
}

export function PriorityBadge({ priority }) {
  return priority ? (
    <Pill tone={priorityTone(priority)} upper>
      {statusLabel(priority)}
    </Pill>
  ) : (
    <span className="ds-empty-value">—</span>
  );
}

export default Pill;
