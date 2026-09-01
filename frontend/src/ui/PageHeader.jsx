import './PageHeader.css';

export default function PageHeader({ title, sub, right }) {
  return (
    <header className="ds-page-head">
      <div>
        {title ? <h1 className="ds-page-head__title">{title}</h1> : null}
        {sub ? <p className="ds-page-head__sub">{sub}</p> : null}
      </div>
      {right ? <div className="ds-page-head__right">{right}</div> : null}
    </header>
  );
}

/** Section heading under the page title (Profile, History, Identity). */
export function SectionTitle({ children, as: Tag = 'h3' }) {
  return <Tag className="ds-section-title">{children}</Tag>;
}

/** A wrapping row of filters. Clear appears only when something is filtered. */
export function FilterRow({ children }) {
  return <div className="ds-filters">{children}</div>;
}
