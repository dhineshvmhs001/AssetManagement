import { useMemo } from 'react';
import { addDays, addMonths, dayOfMonth, formatDay, startOfMonth, weekdayIndex } from './datetime';
import './Calendar.css';

/**
 * The one month grid in this product.
 *
 * It exists because there were two: this one, and whatever the browser drew
 * for <input type="date">. They disagreed about which day a week starts on —
 * the native picker opened on Sunday, this one on Monday — which is the kind
 * of difference nobody reports as a bug and everybody notices.
 *
 * Weeks start Monday. Always 42 cells, so the panel never changes height as
 * you page through months.
 */
const WEEK = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export default function CalendarGrid({
  view,
  onViewChange,
  min,
  max,
  dayClass,
  dayDisabled,
  onPick,
  onHover,
  onLeave,
}) {
  const viewMonth = startOfMonth(view);

  const days = useMemo(() => {
    const gridStart = addDays(viewMonth, -weekdayIndex(viewMonth));
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [viewMonth]);

  const canPrev = !min || addMonths(viewMonth, -1) >= startOfMonth(min);
  const canNext = !max || addMonths(viewMonth, 1) <= startOfMonth(max);

  return (
    <div className="ds-cal">
      <div className="ds-cal__nav">
        <button
          type="button"
          disabled={!canPrev}
          aria-label="Previous month"
          onClick={() => onViewChange(addMonths(viewMonth, -1))}
        >
          ‹
        </button>
        <strong>{formatDay(viewMonth, { month: 'long', year: 'numeric' })}</strong>
        <button
          type="button"
          disabled={!canNext}
          aria-label="Next month"
          onClick={() => onViewChange(addMonths(viewMonth, 1))}
        >
          ›
        </button>
      </div>

      <div className="ds-cal__week">
        {WEEK.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className="ds-cal__grid" onMouseLeave={onLeave}>
        {days.map((day) => {
          const outside = startOfMonth(day) !== viewMonth;
          const disabled = Boolean(dayDisabled?.(day));
          return (
            <button
              key={day}
              type="button"
              disabled={disabled}
              aria-label={formatDay(day)}
              onMouseEnter={onHover && !disabled ? () => onHover(day) : undefined}
              onClick={() => onPick(day)}
              className={['ds-cal__day', outside ? 'is-out' : '', dayClass?.(day) || '']
                .filter(Boolean)
                .join(' ')}
            >
              <span>{dayOfMonth(day)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
