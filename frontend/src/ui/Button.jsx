import './Button.css';

export function Spinner() {
  return <span className="ds-spinner" aria-hidden="true" />;
}

/**
 * Pill button. `as` lets it render as a react-router <Link> while keeping the
 * same look — <Button as={Link} to="/inventory/add">.
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  disabled = false,
  block = false,
  as: Tag = 'button',
  type,
  className = '',
  children,
  ...rest
}) {
  // A loading button that is still clickable is the double-submit bug. The two
  // states are never allowed to disagree.
  const isDisabled = disabled || loading;
  const classes = [
    'ds-btn',
    `ds-btn--${variant}`,
    `ds-btn--${size}`,
    block ? 'ds-btn--block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // A disabled <a> is still a link, so an `as` element gets its interaction
  // removed rather than an attribute browsers ignore.
  const guard =
    Tag === 'button'
      ? { disabled: isDisabled, type: type || 'button' }
      : {
          'aria-disabled': isDisabled || undefined,
          tabIndex: isDisabled ? -1 : rest.tabIndex,
          onClick: isDisabled ? (e) => e.preventDefault() : rest.onClick,
        };

  const leading = loading ? <Spinner /> : icon;

  return (
    <Tag className={classes} aria-busy={loading || undefined} {...rest} {...guard}>
      {leading ? <span className="ds-btn__icon">{leading}</span> : null}
      {children}
      {iconRight && !loading ? <span className="ds-btn__icon">{iconRight}</span> : null}
    </Tag>
  );
}
