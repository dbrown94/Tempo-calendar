import React, { useRef, useState, useEffect, useMemo } from 'react';
import './TimeBlock.css';
import EventBlock from '../EventBlock/EventBlock';
import type { CalendarEvent } from '../EventBlock/EventBlock';
import type { PlannedBlock } from '../Goals/types';

type TimeBlockProps = {
  isOpen: boolean;
  onClose: () => void;
  plannedBlocks?: PlannedBlock[];
};

const HOUR_PX = 40;
const DAY_HEADER_PX = 40;
const HEADER_GAP_PX = 0;

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
const parseRange = (time?: string) => {
  if (!time) return null;
  const parts = time.split('–').map(s => s.trim());
  if (parts.length !== 2) return null;
  return { startMin: toMinutes(parts[0]), endMin: toMinutes(parts[1]) };
};
const fmt12 = (hhmm: string) => {
  if (!hhmm) return '';
  const [H, M] = hhmm.split(':').map(Number);
  const h = (H % 12) || 12;
  const suf = H < 12 ? 'AM' : 'PM';
  return `${h}:${String(M).padStart(2, '0')}${suf}`;
};
const fmtRange12 = (range: string | undefined) => {
  if (!range) return '';
  const [start, end] = range.split('–').map(s => s.trim());
  return `${fmt12(start)} – ${fmt12(end)}`;
};

type ColorMenuState = {
  open: boolean;
  x: number;
  y: number;
  ev: CalendarEvent | null;
};

const TimeBlock: React.FC<TimeBlockProps> = ({ isOpen, onClose, plannedBlocks = [] }) => {
  const [weekStartDate, setWeekStartDate] = useState(new Date());
  const [events, setEvents] = useState<Map<string, CalendarEvent>>(new Map());
  const [selectedCell, setSelectedCell] = useState<string | null>(null);

  const externalEvents = useMemo(() => {
    const map = new Map<string, CalendarEvent>();
    for (const pb of plannedBlocks) {
      const start = new Date(pb.startISO);
      const end   = new Date(pb.endISO);
      const dateStr = start.toISOString().split('T')[0];
      const hour = start.getHours();
      const key = `${dateStr}::${hour}`;

      const toHM = (d: Date) => `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;

      map.set(key, {
        title: pb.taskTitle ?? pb.title,
        time: `${toHM(start)} – ${toHM(end)}`,
        notes: pb.milestoneTitle ? `Milestone: ${pb.milestoneTitle}` : undefined,
        color: pb.color ?? '#4F46E5',
      });
    }
    return map;
  }, [plannedBlocks]);

  const allEvents = useMemo(() => {
    const merged = new Map(events);
    for (const [k, v] of externalEvents) merged.set(k, v);
    return merged;
  }, [events, externalEvents]);

  const [colorMenu, setColorMenu] = useState<ColorMenuState>({
    open: false, x: 0, y: 0, ev: null,
  });

  const monthLabelRef = useRef<HTMLSpanElement>(null);

  const getDateKey = (dayIndex: number, hour: number) => {
    const date = new Date(weekStartDate);
    date.setDate(date.getDate() - date.getDay() + dayIndex);
    const dateStr = date.toISOString().split('T')[0];
    return `${dateStr}::${hour}`;
  };

  const goToPrevWeek = () => {
    const newDate = new Date(weekStartDate);
    newDate.setDate(newDate.getDate() - 7);
    setWeekStartDate(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(weekStartDate);
    newDate.setDate(newDate.getDate() + 7);
    setWeekStartDate(newDate);
  };

  const closeEventModal = () => {
    const modal = document.getElementById('eventModal') as HTMLDivElement;
    if (modal) modal.style.display = 'none';

    ['eventTitle', 'eventStartTime', 'eventEndTime', 'eventLocation', 'eventGuests', 'eventNotes'].forEach(id => {
      const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
      if (el) el.value = '';
    });

    setSelectedCell(null);
  };

  const saveEvent = () => {
    const title = (document.getElementById('eventTitle') as HTMLInputElement).value.trim();
    const typeEl = (document.getElementById('eventType') as HTMLSelectElement);
    const eventType = typeEl ? typeEl.value : '';
    const start = (document.getElementById('eventStartTime') as HTMLInputElement).value;
    const end   = (document.getElementById('eventEndTime') as HTMLInputElement).value;
    const location = (document.getElementById('eventLocation') as HTMLInputElement).value.trim();
    const guests   = (document.getElementById('eventGuests') as HTMLInputElement).value.trim();
    const notes    = (document.getElementById('eventNotes') as HTMLTextAreaElement).value.trim();
    const moodColor = (document.getElementById('moodColor') as HTMLInputElement)?.value || '#4CAF50';

    if (!title || !start || !end || !selectedCell) return;

    const event = {
      title,
      time: `${start} – ${end}`,
      location,
      guests,
      notes,
      color: moodColor,
      eventType,
    } as CalendarEvent & { eventType?: string };

    setEvents(prev => new Map(prev).set(selectedCell, event));
    closeEventModal();
  };

  const daySpans = useMemo(() => {
    const byDay = new Map<string, Array<{ startMin: number; endMin: number; event: CalendarEvent }>>();
    for (const [cellKey, ev] of allEvents.entries()) {
      const [dayKey] = cellKey.split('::');
      const range = parseRange(ev.time);
      if (!range) continue;
      const startMin = range.startMin;
      const endMin = Math.max(range.startMin + 15, range.endMin);
      const arr = byDay.get(dayKey) ?? [];
      arr.push({ startMin, endMin, event: ev });
      byDay.set(dayKey, arr);
    }
    for (const [, arr] of byDay) arr.sort((a, b) => a.startMin - b.startMin);
    return byDay;
  }, [allEvents]);

  const openColorMenu = (ev: CalendarEvent, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setColorMenu({
      open: true,
      x: rect.left + rect.width - 8,
      y: rect.top + 8,
      ev,
    });
  };
  const closeColorMenu = () => setColorMenu({ open: false, x: 0, y: 0, ev: null });

  useEffect(() => {
    const onDocClick = () => colorMenu.open && closeColorMenu();
    window.addEventListener('click', onDocClick);
    return () => window.removeEventListener('click', onDocClick);
  }, [colorMenu.open]);

  const renderTimeGrid = () => {
    const hours = Array.from({ length: 24 }, (_, h) => `${(h % 12) || 12}:00${h < 12 ? 'AM' : 'PM'}`);

    const days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStartDate);
      date.setDate(date.getDate() - date.getDay() + i);
      return {
        label: date.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase(),
        number: date.getDate(),
        index: i,
        key: date.toISOString().split('T')[0],
      };
    });

    return (
      <>
        <div className="time-column">
          {hours.map((hour, h) => (
            <div key={h} style={{ height: HOUR_PX }}>{hour}</div>
          ))}
        </div>

        <div className="days-wrapper">
          {days.map(day => (
            <div key={day.index} className="day-column" style={{ position: 'relative' }}>
              <div className="time-block-day-header" style={{ height: DAY_HEADER_PX }}>
                <span className="day-name">{day.label}</span>
                <span className="day-number">{day.number}</span>
              </div>

              {hours.map((_, h) => {
                const cellKey = getDateKey(day.index, h);
                return (
                  <div
                    key={h}
                    className="time-block"
                    style={{ height: HOUR_PX }}
                    onClick={() => {
                      setSelectedCell(cellKey);
                      const modal = document.getElementById('eventModal') as HTMLDivElement;
                      modal.style.display = 'flex';
                    }}
                  />
                );
              })}

              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: DAY_HEADER_PX + HEADER_GAP_PX,
                  height: HOUR_PX * 24,
                  pointerEvents: 'none',
                  zIndex: 1,
                }}
              >
                {(daySpans.get(day.key) ?? []).map((span, idx) => {
                  const top = (span.startMin / 60) * HOUR_PX;
                  const height = ((span.endMin - span.startMin) / 60) * HOUR_PX;

                  const ev = span.event as CalendarEvent & {
                    eventType?: string;
                    location?: string;
                    guests?: string;
                    notes?: string;
                  };

                  return (
                    <div
                      key={idx}
                      title={`${ev.title} (${fmtRange12(ev.time)})`}
                      style={{
                        position: 'absolute',
                        left: 8,
                        right: 8,
                        top,
                        height,
                        borderRadius: 16,
                        padding: 0,
                        boxShadow: '0 6px 16px rgba(0,0,0,.25), inset 0 1px 2px rgba(255,255,255,.25)',
                        background: ev.color || 'rgba(76,175,80,.9)',
                        pointerEvents: 'auto',
                        cursor: 'pointer',
                        overflow: 'hidden',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        openColorMenu(span.event, e);
                      }}
                    >
                      <div className="event-chip">
                        <div className="chip-row">
                          <div className="chip-title">{ev.title}</div>
                          <div className="chip-time">{fmtRange12(ev.time)}</div>
                        </div>

                        <div className="chip-meta">
                          {ev.eventType && <span className="chip-pill">{ev.eventType}</span>}
                          {ev.location && <span className="chip-meta-item">📍 {ev.location}</span>}
                          {ev.guests &&   <span className="chip-meta-item">👥 {ev.guests}</span>}
                        </div>

                        {ev.notes && <div className="chip-notes">{ev.notes}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </>
    );
  };

  useEffect(() => {
    if (monthLabelRef.current) {
      const month = weekStartDate.toLocaleString('default', { month: 'long' });
      const year = weekStartDate.getFullYear();
      monthLabelRef.current.textContent = `${month} ${year}`;
    }
  }, [weekStartDate]);

  return (
    <>
      <div className={`time-block-overlay ${isOpen ? 'show' : 'hide'}`}>
        <div className="time-block-modal">
          <div className="time-block-month-header">
            <button onClick={goToPrevWeek}>‹</button>
            <span ref={monthLabelRef}></span>
            <button onClick={goToNextWeek}>›</button>
          </div>

          <div className="time-block-header">
            <h2>Time Block View</h2>
            <button className="close-time-block" onClick={onClose}>×</button>
          </div>

          <div className="time-block-content">{renderTimeGrid()}</div>
        </div>
      </div>

      <div className="event-modal" id="eventModal" style={{ display: 'none' }}>
        <h3>Add Event</h3>
        <input type="text" id="eventTitle" placeholder="Event title" />
        <label htmlFor="moodColor">Mood Color</label>
        <input type="color" id="moodColor" defaultValue="#4CAF50" />
        <div className="time-range">
          <label>Start:</label>
          <input type="time" id="eventStartTime" />
          <label>End:</label>
          <input type="time" id="eventEndTime" />
        </div>
        <select id="eventType">
          <option value="event">Event</option>
          <option value="task">Task</option>
          <option value="meeting">Meeting</option>
          <option value="family">Family</option>
        </select>
        <input type="text" id="eventLocation" placeholder="Location (optional)" />
        <input type="text" id="eventGuests" placeholder="Add guests (@Tempoers)" />
        <textarea id="eventNotes" placeholder="Notes..."></textarea>
        <div className="event-modal-buttons">
          <button className="save-btn" onClick={saveEvent}>Save</button>
          <button className="cancel-btn" onClick={closeEventModal}>Cancel</button>
        </div>
      </div>

      {selectedCell && events.has(selectedCell) && (
        <div className="journal-popup">
          <EventBlock event={events.get(selectedCell)!} />
        </div>
      )}
    </>
  );
};

export default TimeBlock;
