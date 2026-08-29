import { Children, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import './Select.css';

/**
 * Custom dropdown with the native <select> API — `value`, `onChange` receiving
 * `{ target: { value } }`, and <option> children. Native selects render their
 * popup with the OS palette (and dark-on-dark in some browsers), which is the
 * one part of a form no stylesheet can reach.
 *
 * An <option> may carry a `count` prop, rendered beside the label.
 */
export default function Select({
  value = '',
  onChange,
  children,
  placeholder = 'Select…',
  onDark = false,
  disabled = false,
  id,
  className = '',
  style,
  'aria-label': ariaLabel,
  ...rest
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [dropUp, setDropUp] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const autoId = useId();
  const listId = `${id || autoId}-list`;

  const options = useMemo(
    () =>
      Children.toArray(children)
        .filter((child) => child?.props)
        .map((child) => ({
          value: child.props.value ?? '',
          label: child.props.children,
          count: child.props.count,
          disabled: child.props.disabled,
        })),
    [children],
  );

  // "" is a real choice — "All statuses", "— Both teams —" — not an absence,
  // so it matches like any other value rather than falling through to the
  // placeholder.
  const selectedIndex = options.findIndex((opt) => String(opt.value) === String(value));
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  const close = useCallback(() => {
    setOpen(false);
    setActive(-1);
  }, []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    function onPointer(event) {
      if (!rootRef.current?.contains(event.target)) {
        close();
      }
    }
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open, close]);

  // Flip above the button when there is no room below, so the last filter in a
  // row is not a list clipped by the viewport.
  useEffect(() => {
    if (!open || !buttonRef.current) {
      return;
    }
    const rect = buttonRef.current.getBoundingClientRect();
    setDropUp(window.innerHeight - rect.bottom < 280 && rect.top > 280);
  }, [open]);

  useEffect(() => {
    if (open && active >= 0) {
      listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
    }
  }, [open, active]);

  function pick(option) {
    if (option.disabled) {
      return;
    }
    close();
    buttonRef.current?.focus();
    if (String(option.value) !== String(value)) {
      onChange?.({ target: { value: option.value } });
    }
  }

  function openList(startAt) {
    setOpen(true);
    setActive(startAt ?? (selectedIndex >= 0 ? selectedIndex : 0));
  }

  function onKeyDown(event) {
    if (disabled) {
      return;
    }
    const { key } = event;
    if (!open) {
      if (key === 'Enter' || key === ' ' || key === 'ArrowDown' || key === 'ArrowUp') {
        event.preventDefault();
        openList(key === 'ArrowUp' ? options.length - 1 : undefined);
      }
      return;
    }
    if (key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (key === 'Tab') {
      close();
      return;
    }
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault();
      const step = key === 'ArrowDown' ? 1 : -1;
      setActive((i) => {
        const next = i + step;
        if (next < 0) return options.length - 1;
        if (next >= options.length) return 0;
        return next;
      });
      return;
    }
    if (key === 'Home' || key === 'End') {
      event.preventDefault();
      setActive(key === 'Home' ? 0 : options.length - 1);
      return;
    }
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      if (options[active]) {
        pick(options[active]);
      }
    }
  }

  const classes = ['ds-select', onDark ? 'ds-select--on-dark' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} style={style} ref={rootRef} {...rest}>
      <button
        type="button"
        ref={buttonRef}
        id={id}
        className="ds-select__button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
      >
        <span className="ds-select__value">
          {selected ? selected.label : <span className="ds-muted">{placeholder}</span>}
        </span>
        <span className="ds-select__caret" aria-hidden="true">
          ▼
        </span>
      </button>

      {open ? (
        <ul
          id={listId}
          ref={listRef}
          className={`ds-select__list${dropUp ? ' ds-select__list--up' : ''}`}
          role="listbox"
          tabIndex={-1}
        >
          {options.length === 0 ? (
            <li className="ds-select__empty">No options</li>
          ) : (
            options.map((option, index) => (
              <li
                key={`${option.value}`}
                role="option"
                aria-selected={index === selectedIndex}
                aria-disabled={option.disabled || undefined}
                className={[
                  'ds-select__option',
                  index === active ? 'is-active' : '',
                  index === selectedIndex ? 'is-selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(option)}
              >
                <span>{option.label}</span>
                {option.count !== undefined && option.count !== null ? (
                  <span className="ds-select__count">{option.count}</span>
                ) : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

/** Mirrors <option> so the markup reads the same as a native select. */
export function Option() {
  return null;
}
