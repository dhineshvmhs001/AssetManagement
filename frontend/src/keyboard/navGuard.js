// A page with unsaved work registers a guard here. Keyboard shortcuts ask
// before navigating away, so a stray Tab or arrow key cannot discard a form.
let guard = null;

export function setNavGuard(fn) {
  guard = fn;
}

export function clearNavGuard(fn) {
  if (!fn || guard === fn) {
    guard = null;
  }
}

export function allowNav() {
  return guard ? guard() : true;
}

// True when the visible page has a form, in which case Tab belongs to the
// form's own fields rather than to the sidebar rail.
export function pageHasForm() {
  return Boolean(document.querySelector('form'));
}
