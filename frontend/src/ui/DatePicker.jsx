import { useCallback, useEffect, useRef, useState } from 'react';
import Button from './Button';
import CalendarGrid from './CalendarGrid';
import usePopoverPlacement from './usePopoverPlacement';
import { formatDay, istDay, startOfMonth } from './datetime';
import './DatePicker.css';

function CalendarIcon() {
  return (
    <svg className="ds-datepick__icon" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1.5" y="3" width="13" height="11.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1.5 6.5h13M5 1.5v3M11 1.5v3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/**
 * A single date, in the app's own calendar.
 *
 * Replaces <input type="date">, which handed the job to the browser: US
 * mm/dd/yyyy ordering on an IST product, a Sunday-first week against this
 * app's Monday-first one, no theming, and — the part that actually cost
 * people time — no way to express the rules the server enforces, so the
 * native picker happily offered dates that the API would reject on submit.
 *
 * `min`/`max` are YYYY-MM-DD strings. Days outside them are shown greyed
 * rather than hidden, so the limit is visible while choosing.
 */
export default function DatePicker({
  value = '',
  onChange,
  min,
  max,
  disabled = false,
  required = false,
  clearable = true,
  placeholder = 'Select a date',
  id,
  name,
  'aria-label': ariaLabel,
  'aria-describedby': describedBy,
}) {
  const today = istDay();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(startOfMonth(value || max || today));
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const popRef = useRef(null);
  const place = usePopoverPlacement(open, buttonRef, popRef, { minHeight: 300 });

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    setView(startOfMonth(value || max || today));
    function onPointer(event) {
      if (!rootRef.current?.contains(event.target)) {
        close();
      }
    }
    function onKey(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, value, max, today, close]);

  function outOfBounds(day) {
    return Boolean((min && day < min) || (max && day > max));
  }

  function commit(day) {
    if (outOfBounds(day)) {
      return;
    }
    onChange?.(day);
    close();
    buttonRef.current?.focus();
  }

  function commitClear() {
    onChange?.('');
    close();
    buttonRef.current?.focus();
  }

  function dayClass(day) {
    return [day === value ? 'is-start is-end is-single' : '', day === today ? 'is-today' : '']
      .filter(Boolean)
      .join(' ');
  }

  const todayReachable = !outOfBounds(today);

  return (
    <div className={`ds-datepick${disabled ? ' is-disabled' : ''}`} ref={rootRef}>
      {/*
        These forms gate submission on native validation, and a <button> is
        never `required` — swapping the date input for one would have quietly
        dropped that check. This carries the constraint instead: transparent
        but laid over the trigger's own box, so it is focusable and the
        browser's message points at the right field. It must not be readOnly —
        readonly controls are barred from constraint validation, which would
        make `required` do nothing.
      */}
      <input
        className="ds-datepick__native"
        type="text"
        name={name}
        value={value}
        required={required}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        onChange={() => {}}
        onFocus={() => buttonRef.current?.focus()}
      />

      <button
        type="button"
        id={id}
        ref={buttonRef}
        className={`ds-datepick__button${value ? ' has-value' : ''}`}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-required={required || undefined}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        onClick={() => setOpen((prev) => !prev)}
      >
        <CalendarIcon />
        <span className="ds-datepick__value">{value ? formatDay(value) : placeholder}</span>
        <span className="ds-datepick__caret" aria-hidden="true">
          ▼
        </span>
      </button>

      {open ? (
        <div
          ref={popRef}
          className={`ds-datepick__pop${place.up ? ' ds-datepick__pop--up' : ''}`}
          style={{
            maxHeight: place.maxHeight ?? undefined,
            transform: place.shiftX ? `translateX(${place.shiftX}px)` : undefined,
          }}
          role="dialog"
          aria-label={ariaLabel || 'Choose a date'}
        >
          <div className="ds-datepick__body">
            <CalendarGrid
              view={view}
              onViewChange={setView}
              min={min}
              max={max}
              dayClass={dayClass}
              dayDisabled={outOfBounds}
              onPick={commit}
            />
          </div>

          <div className="ds-datepick__foot">
            {clearable && !required ? (
              <Button variant="secondary" size="sm" onClick={commitClear}>
                Clear
              </Button>
            ) : (
              <span />
            )}
            <Button variant="primary" size="sm" disabled={!todayReachable} onClick={() => commit(today)}>
              Today
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
