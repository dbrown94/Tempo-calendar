import React, { useEffect, useMemo, useRef, useState } from 'react';
import './FullCalendar.css';
import type { PlannedBlock } from '../Goals/types';

const daysOfWeek = ['SUN','MON','TUE','WED','THU','FRI','SAT'] as const;
const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const;

type DateKey = `${number}-${string}-${string}`;

type CalendarEvent = {
  id: string;
  title: string;
  time?: string;
  notes?: string;
  location?: string;
  guests?: string;
  moodColor?: string;
};

type EventsByDay = Record<DateKey, CalendarEvent[]>;

const pad = (n: number) => String(n).padStart(2, '0');
const getDateKey = (y: number, m: number, d: number): DateKey =>
  `${y}-${pad(m + 1)}-${pad(d)}` as DateKey;

type Props = {
  plannedBlocks?: PlannedBlock[];
};

const FullCalendar: React.FC<Props> = ({ plannedBlocks = [] }) => {
  const today = new Date();

  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDateKey, setSelectedDateKey] = useState<DateKey>(
    getDateKey(today.getFullYear(), today.getMonth(), today.getDate())
  );

  const [events, setEvents] = useState<EventsByDay>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<{ title: string; time: string; notes: string }>({
    title: '',
    time: '',
    notes: '',
  });

  const modalFirstInputRef = useRef<HTMLInputElement>(null);

  const { blanks, days } = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    const blanks = Array(firstDay).fill(null);
    const days = Array.from({ length: totalDays }, (_, i) => i + 1);
    return { blanks, days };
  }, [currentMonth, currentYear]);

  const changeMonth = (dir: 'prev' | 'next') => {
    setCurrentMonth(m => {
      if (dir === 'prev') {
        if (m === 0) {
          setCurrentYear(y => y - 1);
          return 11;
        }
        return m - 1;
      } else {
        if (m === 11) {
          setCurrentYear(y => y + 1);
          return 0;
        }
        return m + 1;
      }
    });
  };

  const openModalFor = (dateKey: DateKey) => {
    setSelectedDateKey(dateKey);
    setForm({ title: '', time: '', notes: '' });
    setModalVisible(true);
  };

  const saveEvent = () => {
    if (!form.title.trim()) return;
    const newEvent: CalendarEvent = {
      id: crypto.randomUUID(),
      title: form.title.trim(),
      time: form.time || undefined,
      notes: form.notes || undefined,
    };
    setEvents(prev => {
      const list = prev[selectedDateKey] ?? [];
      return { ...prev, [selectedDateKey]: [...list, newEvent] };
    });
    setModalVisible(false);
  };

  const deleteEvent = (dateKey: DateKey, id: string) => {
    setEvents(prev => ({
      ...prev,
      [dateKey]: (prev[dateKey] ?? []).filter(e => e.id !== id),
    }));
  };

  useEffect(() => {
    if (modalVisible) modalFirstInputRef.current?.focus();
  }, [modalVisible]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalVisible(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onDayKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, day: number) => {
    const move = (delta: number) => {
      const d = new Date(currentYear, currentMonth, day + delta);
      setCurrentMonth(d.getMonth());
      setCurrentYear(d.getFullYear());
      setSelectedDateKey(getDateKey(d.getFullYear(), d.getMonth(), d.getDate()));
    };
    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); move(1); break;
      case 'ArrowLeft':  e.preventDefault(); move(-1); break;
      case 'ArrowDown':  e.preventDefault(); move(7); break;
      case 'ArrowUp':    e.preventDefault(); move(-7); break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        openModalFor(getDateKey(currentYear, currentMonth, day));
        break;
    }
  };

  const selectedEvents = events[selectedDateKey] ?? [];
  const todayKey = getDateKey(today.getFullYear(), today.getMonth(), today.getDate());

  const plannedCountByDate = useMemo(() => {
    const map = new Map<DateKey, number>();
    for (const pb of plannedBlocks) {
      const d = new Date(pb.startISO);
      const key = getDateKey(d.getFullYear(), d.getMonth(), d.getDate());
      map.set(key as DateKey, (map.get(key as DateKey) ?? 0) + 1);
    }
    return map;
  }, [plannedBlocks]);

  return (
    <div className="event-calendar-container" aria-label="Calendar">
      {/* Sidebar */}
      <aside className="event-calendar-sidebar">
        <div className="event-calendar-date" aria-live="polite">
          <span className="event-calendar-date-number">
            {selectedDateKey.split('-')[2]}
          </span>
          <span className="event-calendar-day-text">
            {new Date(selectedDateKey).toLocaleDateString(undefined, { weekday: 'long' }).toUpperCase()}
          </span>
        </div>

        <div className="event-calendar-event-section">
          <h3>Current Events</h3>
          <ul className="event-calendar-event-list">
            {selectedEvents.length === 0 && (
              <li className="event-card" aria-disabled="true">No events yet.</li>
            )}
            {selectedEvents.map(ev => (
              <li key={ev.id} className="event-card">
                <div className="event-card-title">{ev.title}</div>
                {ev.time && <div className="event-card-time">{ev.time}</div>}
                {ev.notes && <div className="event-card-notes">{ev.notes}</div>}
                <button
                  className="event-card-delete"
                  aria-label={`Delete ${ev.title}`}
                  onClick={() => deleteEvent(selectedDateKey, ev.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <button className="event-calendar-see-events" onClick={() => openModalFor(selectedDateKey)}>
            + Add event
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="event-calendar-main">
        <div className="event-calendar-header">
          <button
            className="event-calendar-prev-month"
            onClick={() => changeMonth('prev')}
            aria-label="Previous Month"
          >
            {'<'}
          </button>
          <span className="event-calendar-current-year" aria-live="polite">
            {currentYear}
          </span>
          <button
            className="event-calendar-next-month"
            onClick={() => changeMonth('next')}
            aria-label="Next Month"
          >
            {'>'}
          </button>
        </div>

        <div className="event-calendar-month-switcher" role="tablist" aria-label="Choose month">
          {months.map((m, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === currentMonth}
              className={`event-calendar-month ${i === currentMonth ? 'active' : ''}`}
              onClick={() => setCurrentMonth(i)}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="event-calendar-grid">
          {daysOfWeek.map(d => (
            <div key={d} className="event-calendar-day-label">{d}</div>
          ))}

          {blanks.map((_, i) => (
            <div key={`blank-${i}`} className="event-calendar-day event-calendar-empty" />
          ))}

          {days.map(day => {
            const dateKey = getDateKey(currentYear, currentMonth, day);
            const hasEvents = (events[dateKey]?.length ?? 0) > 0;
            const isToday = dateKey === todayKey;
            const isSelected = dateKey === selectedDateKey;
            const plannedCount = plannedCountByDate.get(dateKey) ?? 0;

            return (
              <div
                key={dateKey}
                tabIndex={0}
                role="button"
                aria-pressed={isSelected}
                aria-label={`Select ${months[currentMonth]} ${day}, ${currentYear}`}
                className={[
                  'event-calendar-day',
                  isToday ? 'is-today' : '',
                  isSelected ? 'is-selected' : ''
                ].filter(Boolean).join(' ')}
                onClick={() => setSelectedDateKey(dateKey)}
                onKeyDown={(e) => onDayKeyDown(e, day)}
              >
                <span>{day}</span>

                <button
                  type="button"
                  className="event-add-btn"
                  aria-label={`Add event for ${months[currentMonth]} ${day}`}
                  onClick={(e) => { e.stopPropagation(); openModalFor(dateKey); }}
                >
                  +
                </button>

                {hasEvents && (
                  <div className="event-indicator" aria-label={`${events[dateKey].length} events`}>
                    {events[dateKey].length}
                  </div>
                )}

                {plannedCount > 0 && (
                  <div
                    aria-label={`${plannedCount} planned blocks`}
                    style={{
                      position: 'absolute',
                      bottom: 6,
                      left: 6,
                      minWidth: 20,
                      height: 20,
                      padding: '0 6px',
                      borderRadius: 10,
                      fontSize: 12,
                      lineHeight: '20px',
                      background: 'rgba(120, 200, 255, 0.5)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.25)',
                      backdropFilter: 'blur(6px)',
                    }}
                  >
                    {plannedCount}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* Modal */}
      {modalVisible && (
        <div
          className="calendar-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="addEventTitle"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModalVisible(false);
          }}
        >
          <div className="calendar-modal" onMouseDown={(e) => e.stopPropagation()}>
            <h3 id="addEventTitle">Add Event</h3>
            <input
              ref={modalFirstInputRef}
              type="text"
              placeholder="Event title..."
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
            <input
              type="time"
              value={form.time}
              onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
            />
            <textarea
              placeholder="Notes..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
            <div className="calendar-modal-buttons">
              <button onClick={saveEvent}>Save</button>
              <button onClick={() => setModalVisible(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FullCalendar;
