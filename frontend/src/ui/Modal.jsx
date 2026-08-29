import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './Modal.css';

/**
 * Centred dialog. Portalled to <body>: rendered in place, any page-transition
 * transform on an ancestor becomes the containing block for `position: fixed`,
 * and the backdrop paints *under* the sticky topbar instead of over it.
 *
 * Pass no `onClose` while a save is in flight and Escape stops closing, so a
 * stray keypress cannot discard work mid-write.
 */
export default function Modal({
  open = true,
  onClose,
  title,
  subtitle,
  headerActions,
  footer,
  width = 560,
  children,
}) {
  const bodyRef = useRef(null);
  const restoreRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    restoreRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    bodyRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open || !onClose) {
      return undefined;
    }
    function onKey(event) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      className="ds-modal__backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div
        className="ds-modal"
        style={{ maxWidth: width }}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
      >
        {title || headerActions || onClose ? (
          <header className="ds-modal__head">
            <div>
              <h2 className="ds-modal__title">{title}</h2>
              {subtitle ? <p className="ds-modal__sub">{subtitle}</p> : null}
            </div>
            <div className="ds-modal__head-actions">
              {headerActions}
              <button
                type="button"
                className="ds-modal__close"
                onClick={onClose}
                disabled={!onClose}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          </header>
        ) : null}
        <div className="ds-modal__body" ref={bodyRef} tabIndex={-1}>
          {children}
        </div>
        {footer ? <footer className="ds-modal__foot">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}

/** Scrolling form on the left, pinned reference rail on the right. */
export function WorkSurface({ children, rail }) {
  return (
    <div className="ds-worksurface">
      <div>{children}</div>
      <aside className="ds-worksurface__rail">{rail}</aside>
    </div>
  );
}
