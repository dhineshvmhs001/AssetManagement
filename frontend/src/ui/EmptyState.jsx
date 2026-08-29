import './EmptyState.css';

export default function EmptyState({ icon = '◍', title, sub, actions }) {
  return (
    <div className="ds-empty">
      <span className="ds-empty__icon" aria-hidden="true">
        {icon}
      </span>
      <p className="ds-empty__title">{title}</p>
      {sub ? <p className="ds-empty__sub">{sub}</p> : null}
      {actions ? <div className="ds-empty__actions">{actions}</div> : null}
    </div>
  );
}
