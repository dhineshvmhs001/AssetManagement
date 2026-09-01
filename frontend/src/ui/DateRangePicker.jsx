import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Button from './Button';
import CalendarGrid from './CalendarGrid';
import usePopoverPlacement from './usePopoverPlacement';
import {
  addDays,
  addMonths,
  daysBetween,
  endOfMonth,
  formatDay,
  formatDayRange,
  istDay,
  startOfMonth,
} from './datetime';
import './DateRangePicker.css';

const MIN_POP_HEIGHT = 260;

// The PRD caps one query at 90 days (risk register: "90-day query cap").
// Retention is the separate, longer limit — older data is reached by moving
// this window back, not by widening it. Defaulted here rather than left to
// each caller, because a page that forgets it silently asks for more than the
// server will answer.
const MAX_SPAN_DAYS = 90;

/**
 * Inclusive of today: "Last 7 days" is seven days ending now, not eight. The
 * summary line states the count, so an off-by-one here reads as a bug.
 */
export function lastDays(n, to = istDay()) {
  return { from: addDays(to, -(n - 1)), to };
}

export function defaultRange() {
  return lastDays(90);
}

export function monthsBack(iso, months) {
  return addMonths(iso, -months);
}

function thisMonth(to = istDay()) {
  return { from: startOfMonth(to), to };
}

function previousMonth(to = istDay()) {
  const from = startOfMonth(addMonths(startOfMonth(to), -1));
  return { from, to: endOfMonth(from) };
}

function monthLabel(iso) {
  return formatDay(iso, { month: 'long', year: 'numeric' });
}

function inRange(day, from, to) {
  if (!from || !to) {
    return false;
  }
  const a = from <= to ? from : to;
  const b = from <= to ? to : from;
  return day >= a && day <= b;
}

/**
 * One uniform two-column grid, shortest span to longest. The old layout mixed
 * full- and half-width buttons on no rule anyone could name, which read as a
 * broken grid and cost ~70px of height the popover could not spare.
 */
function presetsFor(max, min, maxSpanDays) {
  const to = max || istDay();
  const all = [
    { id: 'today', label: 'Today', range: () => ({ from: to, to }) },
    {
      id: 'yesterday',
      label: 'Yesterday',
      range: () => {
        const day = addDays(to, -1);
        return { from: day, to: day };
      },
    },
    { id: '7', label: 'Last 7 days', range: () => lastDays(7, to) },
    { id: '30', label: 'Last 30 days', range: () => lastDays(30, to) },
    { id: '90', label: 'Last 90 days', range: () => lastDays(90, to) },
    { id: 'month', label: 'This month', range: () => thisMonth(to) },
    { id: 'prev', label: 'Previous month', range: () => previousMonth(to) },
    { id: '24', label: 'Last 24 months', range: () => ({ from: min || addMonths(to, -24), to }) },
  ];
  if (!maxSpanDays) {
    return all;
  }
  return all.filter((item) => {
    const range = item.range();
    return daysBetween(range.from, range.to) <= maxSpanDays;
  });
}

function CalendarIcon() {
  return (
    <svg className="ds-daterange__icon" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1.5" y="3" width="13" height="11.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1.5 6.5h13M5 1.5v3M11 1.5v3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export default function DateRangePicker({
  from,
  to,
  min,
  max,
  maxSpanDays = MAX_SPAN_DAYS,
  onChange,
  label = 'Date range',
  'aria-label': ariaLabel,
}) {
  const cap = max || istDay();
  const floor = min || addMonths(cap, -24);
  const presets = useMemo(() => presetsFor(cap, floor, maxSpanDays), [cap, floor, maxSpanDays]);

  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [hover, setHover] = useState(null);
  const [view, setView] = useState(startOfMonth(to || cap));
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const popRef = useRef(null);
  const place = usePopoverPlacement(open, buttonRef, popRef, { minHeight: MIN_POP_HEIGHT });

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    setDraftFrom(from);
    setDraftTo(to);
    setHover(null);
    setView(startOfMonth(to || cap));
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
  }, [open, from, to, cap, close]);

  const activePreset = presets.find((item) => {
    const range = item.range();
    return range.from === from && range.to === to;
  });

  const previewTo = draftTo || hover;
  const start = draftFrom && previewTo && draftFrom > previewTo ? previewTo : draftFrom;
  const end = draftFrom && previewTo && draftFrom > previewTo ? draftFrom : previewTo;

  function emit(next) {
    let a = next.from <= next.to ? next.from : next.to;
    let b = next.from <= next.to ? next.to : next.from;
    if (a < floor) {
      a = floor;
    }
    if (b > cap) {
      b = cap;
    }
    if (maxSpanDays && daysBetween(a, b) > maxSpanDays) {
      a = addDays(b, -(maxSpanDays - 1));
      if (a < floor) {
        a = floor;
      }
    }
    onChange?.({ from: a, to: b });
  }

  function outsideSpan(day) {
    return Boolean(maxSpanDays && draftFrom && !draftTo && daysBetween(draftFrom, day) > maxSpanDays);
  }

  function applyPreset(item) {
    emit(item.range());
    close();
    buttonRef.current?.focus();
  }

  function pickDay(day) {
    if (day < floor || day > cap || outsideSpan(day)) {
      return;
    }
    if (!draftFrom || (draftFrom && draftTo)) {
      setDraftFrom(day);
      setDraftTo('');
      setHover(null);
      return;
    }
    const next = draftFrom <= day ? { from: draftFrom, to: day } : { from: day, to: draftFrom };
    setDraftFrom(next.from);
    setDraftTo(next.to);
  }

  function applyDraft() {
    if (!draftFrom) {
      return;
    }
    emit({ from: draftFrom, to: draftTo || draftFrom });
    close();
    buttonRef.current?.focus();
  }

  function reset() {
    emit(lastDays(90, cap));
    close();
    buttonRef.current?.focus();
  }

  function dayClass(day) {
    const isStart = Boolean(start) && day === start;
    const isEnd = Boolean(end) && day === end;
    const mid = start && end && inRange(day, start, end) && !isStart && !isEnd;
    return [
      isStart ? 'is-start' : '',
      isEnd ? 'is-end' : '',
      mid ? 'is-mid' : '',
      isStart && isEnd ? 'is-single' : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  const isDefault = activePreset?.id === '90';
  const draftEnd = draftTo || draftFrom;
  const changed = Boolean(draftFrom) && (draftFrom !== from || draftEnd !== to);

  return (
    <div className="ds-daterange" ref={rootRef}>
      <button
        type="button"
        ref={buttonRef}
        className={`ds-daterange__button${isDefault ? '' : ' has-clear'}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel || label}
        onClick={() => setOpen((value) => !value)}
      >
        <CalendarIcon />
        <span className="ds-daterange__name">{activePreset ? activePreset.label : 'Custom'}</span>
        <span className="ds-daterange__dates">{formatDayRange(from, to)}</span>
        <span className="ds-daterange__caret" aria-hidden="true">
          ▼
        </span>
      </button>

      {/* A sibling, not a child. It used to be a span[role=button] inside the
          trigger — interactive content nested in a button, which no keyboard
          could reach. */}
      {isDefault ? null : (
        <button
          type="button"
          className="ds-daterange__clear"
          aria-label="Reset to last 90 days"
          title="Reset to last 90 days"
          onClick={() => emit(lastDays(90, cap))}
        >
          ×
        </button>
      )}

      {open ? (
        <div
          ref={popRef}
          className={`ds-daterange__pop${place.up ? ' ds-daterange__pop--up' : ''}`}
          style={{
            maxHeight: place.maxHeight ?? undefined,
            transform: place.shiftX ? `translateX(${place.shiftX}px)` : undefined,
          }}
          role="dialog"
          aria-label="Choose a date range"
        >
          <div className="ds-daterange__body">
            <div className="ds-daterange__presets">
              {presets.map((item) => {
                const range = item.range();
                const on = range.from === draftFrom && range.to === draftEnd;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`ds-daterange__preset${on ? ' is-on' : ''}`}
                    onClick={() => applyPreset(item)}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <CalendarGrid
              view={view}
              onViewChange={setView}
              min={floor}
              max={cap}
              dayClass={dayClass}
              dayDisabled={(day) => day < floor || day > cap || outsideSpan(day)}
              onPick={pickDay}
              onHover={(day) => draftFrom && !draftTo && setHover(day)}
              onLeave={() => setHover(null)}
            />

            <p className="ds-daterange__summary">
              {start && end ? (
                <>
                  <span className="ds-daterange__summary-range">{formatDayRange(start, end)}</span>
                  <span className="ds-daterange__summary-count">{daysBetween(start, end)} days</span>
                </>
              ) : start ? (
                <>
                  <span className="ds-daterange__summary-range">{formatDay(start)}</span>
                  <span className="ds-daterange__summary-count">
                    {maxSpanDays ? `pick an end date · ${maxSpanDays}-day max` : 'pick an end date'}
                  </span>
                </>
              ) : (
                <span className="ds-daterange__summary-count">Pick a start date</span>
              )}
            </p>
          </div>

          <div className="ds-daterange__foot">
            <Button variant="secondary" size="sm" onClick={reset}>
              Last 90 days
            </Button>
            <Button variant="primary" size="sm" disabled={!changed} onClick={applyDraft}>
              Apply
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
