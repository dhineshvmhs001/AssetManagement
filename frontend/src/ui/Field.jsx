import { useId } from 'react';
import './Field.css';

/**
 * Label + control + hint. Honours `style` and `full` — a wrapper that swallows
 * layout props is how a filter row silently collapses to content width.
 */
export function Field({
  label,
  required = false,
  hint,
  error,
  lockedBy,
  full = false,
  htmlFor,
  className = '',
  style,
  children,
  ...rest
}) {
  const classes = ['ds-field', full ? 'ds-field--full' : '', className].filter(Boolean).join(' ');
  return (
    <div className={classes} style={style} {...rest}>
      {label ? (
        <label className="ds-field__label" htmlFor={htmlFor}>
          {label}
          {required ? (
            <span className="ds-field__req" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}
      {children}
      {lockedBy ? <span className="ds-field__lock">{lockedBy}</span> : null}
      {error ? (
        <span className="ds-field__error" role="alert">
          {error}
        </span>
      ) : null}
      {hint && !error ? <span className="ds-field__hint">{hint}</span> : null}
    </div>
  );
}

export function Input({ mono = false, className = '', ...rest }) {
  const classes = ['ds-input', mono ? 'ds-input--mono' : '', className].filter(Boolean).join(' ');
  return <input className={classes} {...rest} />;
}

/**
 * `max` truncates rather than rejecting — a rejected keystroke mid-sentence
 * loses the sentence, and a pasted paragraph loses all of it. The counter
 * makes the ceiling visible before it is hit.
 */
export function Textarea({ max, value = '', onChange, className = '', ...rest }) {
  const text = value ?? '';
  function handle(event) {
    const next = max ? event.target.value.slice(0, max) : event.target.value;
    if (next === text) {
      return;
    }
    onChange?.({
      ...event,
      target: { name: event.target.name, id: event.target.id, value: next },
    });
  }
  return (
    <>
      <textarea
        className={['ds-textarea', className].filter(Boolean).join(' ')}
        value={text}
        onChange={handle}
        {...rest}
      />
      {max ? (
        <span className={`ds-counter${text.length >= max ? ' ds-counter--full' : ''}`}>
          {text.length}/{max}
        </span>
      ) : null}
    </>
  );
}

/** A value shown but not editable here — pair with Field's `lockedBy`. */
export function ReadOnlyValue({ children }) {
  const empty = children === null || children === undefined || children === '';
  return <div className="ds-readonly">{empty ? <span className="ds-empty-value">—</span> : children}</div>;
}

/** Convenience: a labelled input in one line. */
export function TextField({ label, required, hint, error, full, id, ...rest }) {
  const auto = useId();
  const fieldId = id || auto;
  return (
    <Field label={label} required={required} hint={hint} error={error} full={full} htmlFor={fieldId}>
      <Input id={fieldId} required={required} aria-invalid={error ? true : undefined} {...rest} />
    </Field>
  );
}

export default Field;
