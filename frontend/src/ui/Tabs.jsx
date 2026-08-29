import './Tabs.css';

/** items: [{ key, label, icon, count }] */
export default function Tabs({ items, value, onChange, className = '' }) {
  return (
    <div className={['ds-tabs', className].filter(Boolean).join(' ')} role="tablist">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="tab"
          aria-selected={item.key === value}
          className={`ds-tab${item.key === value ? ' is-active' : ''}`}
          onClick={() => onChange(item.key)}
        >
          {item.icon}
          {item.label}
          {item.count !== undefined && item.count !== null ? (
            <span className="ds-tab__count">{item.count}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
