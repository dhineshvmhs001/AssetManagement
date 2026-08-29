let gen = 0;
let armed = false;
let inflight = 0;
let forced = 0;
let visible = false;
let showTimer = null;
let idleTimer = null;
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn(forced > 0 || visible));
}

function setVisible(next) {
  if (visible === next) {
    return;
  }
  visible = next;
  emit();
}

export function armRouteLoading() {
  gen += 1;
  armed = true;
  inflight = 0;
  clearTimeout(showTimer);
  showTimer = null;
  setVisible(false);
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (inflight === 0) {
      armed = false;
    }
  }, 90);
}

export function trackRequestStart() {
  if (!armed) {
    return 0;
  }
  inflight += 1;
  clearTimeout(idleTimer);
  if (!showTimer && !visible) {
    showTimer = setTimeout(() => {
      showTimer = null;
      if (inflight > 0) {
        setVisible(true);
      }
    }, 140);
  }
  return gen;
}

export function trackRequestEnd(startedGen) {
  if (!startedGen || startedGen !== gen) {
    return;
  }
  inflight = Math.max(0, inflight - 1);
  if (inflight === 0) {
    clearTimeout(showTimer);
    showTimer = null;
    armed = false;
    setVisible(false);
  }
}

export function forceLoading(on) {
  forced += on ? 1 : -1;
  if (forced < 0) {
    forced = 0;
  }
  emit();
}

export function subscribeLoading(fn) {
  listeners.add(fn);
  fn(forced > 0 || visible);
  return () => listeners.delete(fn);
}
