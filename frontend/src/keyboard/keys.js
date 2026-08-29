export function isTypingTarget(target) {
  if (!target || typeof target.closest !== 'function') {
    return false;
  }
  const el = target.closest('input, textarea, select, [contenteditable="true"]');
  return Boolean(el);
}

export function isArrowKey(key) {
  return key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight';
}

export function cycleRail(direction) {
  const items = [...document.querySelectorAll('.app-nav a')];
  if (!items.length) {
    return;
  }
  let i = items.findIndex((el) => el.classList.contains('active'));
  if (i < 0) {
    i = 0;
  }
  const next = items[(i + direction + items.length) % items.length];
  next.focus();
  next.click();
}

const FORM_FIELDS = [
  'input:not([type="hidden"]):not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  '.ds-select__button:not([disabled])',
].join(', ');

function isShown(el) {
  if (el.tabIndex < 0 && !el.matches('input, select, textarea')) {
    return false;
  }
  if (el.closest('[hidden]')) {
    return false;
  }
  return el.getClientRects().length > 0;
}

function formFields(form) {
  return [...form.querySelectorAll(FORM_FIELDS)].filter(isShown);
}

function caretAtStart(el) {
  try {
    return el.selectionStart === 0 && el.selectionEnd === 0;
  } catch {
    return true;
  }
}

function caretAtEnd(el) {
  try {
    const n = el.value?.length ?? 0;
    return el.selectionStart === n && el.selectionEnd === n;
  } catch {
    return true;
  }
}

function isTextLike(el) {
  if (!el || el.disabled) {
    return false;
  }
  if (el.matches('textarea, [contenteditable="true"]')) {
    return true;
  }
  if (el.matches('input')) {
    const type = (el.type || 'text').toLowerCase();
    return !['checkbox', 'radio', 'file', 'button', 'submit', 'reset', 'range', 'color'].includes(type);
  }
  return false;
}

// Tab used to walk form fields. Arrows do that now. Left/right still move
// the caret while typing; up/down (and left/right at the ends) leave the field.
export function formArrowDirection(key, target) {
  const el = target?.closest?.('input, textarea, select, .ds-select__button, button');
  if (!el) {
    return 0;
  }

  if (el.closest('.ds-select') && (key === 'ArrowUp' || key === 'ArrowDown')) {
    return 0;
  }

  const next = key === 'ArrowDown' || key === 'ArrowRight' ? 1 : -1;

  if (!isTextLike(el)) {
    return next;
  }

  if (key === 'ArrowUp') {
    return caretAtStart(el) || el.matches('input') ? -1 : 0;
  }
  if (key === 'ArrowDown') {
    return caretAtEnd(el) || el.matches('input') ? 1 : 0;
  }
  if (key === 'ArrowLeft') {
    return caretAtStart(el) ? -1 : 0;
  }
  if (key === 'ArrowRight') {
    return caretAtEnd(el) ? 1 : 0;
  }
  return 0;
}

export function cycleFormField(direction) {
  const form = document.activeElement?.closest?.('form');
  if (!form || !direction) {
    return false;
  }
  const fields = formFields(form);
  if (!fields.length) {
    return false;
  }
  const active = document.activeElement;
  let i = fields.indexOf(active);
  if (i < 0) {
    i = fields.findIndex((el) => el.contains(active));
  }
  if (i < 0) {
    i = direction > 0 ? -1 : 0;
  }
  const next = fields[(i + direction + fields.length) % fields.length];
  next.focus();
  return true;
}

