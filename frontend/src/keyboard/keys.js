export function isTypingTarget(target) {
  if (!target || typeof target.closest !== 'function') {
    return false;
  }
  const el = target.closest('input, textarea, select, [contenteditable="true"]');
  return Boolean(el);
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

