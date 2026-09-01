import { useLayoutEffect, useState } from 'react';

const GAP = 6;
const EDGE = 12;

/**
 * Decides which way a popover opens, and how tall it may be.
 *
 * Measured, never assumed. The first version of this compared the space below
 * the trigger against a hardcoded pixel guess; the panel was taller than the
 * guess, so it opened downward and ran off the bottom of the screen with
 * nothing to scroll. Everything here comes from the real element.
 *
 * Returns { up, maxHeight, shiftX } — apply maxHeight and a translateX to the
 * panel, and the `up` flag to flip it above the trigger.
 */
export default function usePopoverPlacement(open, triggerRef, popRef, { minHeight = 240 } = {}) {
  const [place, setPlace] = useState({ up: false, maxHeight: null, shiftX: 0 });

  useLayoutEffect(() => {
    if (!open) {
      return undefined;
    }
    function measure() {
      const trigger = triggerRef.current;
      const pop = popRef.current;
      if (!trigger || !pop) {
        return;
      }
      const rect = trigger.getBoundingClientRect();
      const height = pop.scrollHeight;
      const below = window.innerHeight - rect.bottom - GAP - EDGE;
      const above = rect.top - GAP - EDGE;
      const up = height > below && above > below;
      const room = Math.max(up ? above : below, minHeight);
      const overflowRight = rect.left + pop.offsetWidth - (window.innerWidth - EDGE);
      setPlace({
        up,
        maxHeight: Math.min(height, room),
        shiftX: overflowRight > 0 ? -Math.min(overflowRight, Math.max(0, rect.left - EDGE)) : 0,
      });
    }
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, triggerRef, popRef, minHeight]);

  return place;
}
