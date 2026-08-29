import './Card.css';

export default function Card({
  padding = 20,
  hover = false,
  glass = false,
  title,
  headerActions,
  className = '',
  style,
  children,
  ...rest
}) {
  const classes = [
    'ds-card',
    hover ? 'ds-card--hover' : '',
    glass ? 'ds-card--glass' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={classes} style={{ padding, ...style }} {...rest}>
      {title || headerActions ? (
        <header className="ds-card__head">
          {title ? <h3 className="ds-card__title">{title}</h3> : <span />}
          {headerActions}
        </header>
      ) : null}
      {children}
    </section>
  );
}
