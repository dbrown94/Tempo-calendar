import React, { useState, useEffect } from "react";
import "./EventBlock.css";

export type CalendarEvent = {
  title: string;
  time: string;
  location?: string;
  guests?: string;
  notes?: string;
  color: string;
  journal?: string;
};

type EventBlockProps = {
  event: CalendarEvent;
};

const EventBlock: React.FC<EventBlockProps> = ({ event }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [journalText, setJournalText] = useState(event.journal || "");
  const [savedPreview, setSavedPreview] = useState(event.journal || "");

  useEffect(() => {
    setJournalText(event.journal || "");
    setSavedPreview(event.journal || "");
  }, [event]);

  const toggleOpen = () => {
    if (!isOpen) setIsOpen(true);
  };

  const saveReflection = () => {
    setSavedPreview(journalText);
    setIsOpen(false);
  };

  const tooltipLines = [
    `📌 ${event.title}`,
    `⏰ ${event.time}`,
    event.location ? `📍 ${event.location}` : null,
    event.guests ? `👥 ${event.guests}` : null,
    event.notes ? `📝 ${event.notes}` : null,
  ].filter(Boolean) as string[];

  return (
    <div
      className="event-block"
      onClick={toggleOpen}
      style={{ backgroundColor: event.color }}
      title={tooltipLines.join("\n")}
    >
      <div className="event-title">{`${event.title} (${event.time})`}</div>

      {savedPreview && !isOpen && (
        <div
          className="journal-preview"
          title={`Saved: ${new Date().toLocaleString()}`}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(true);
          }}
        >
          {savedPreview}
        </div>
      )}

      {isOpen && (
        <div className="journal-entry" onClick={(e) => e.stopPropagation()}>
          <div className="journal-title">{event.title}</div>
          <div className="journal-time">{event.time}</div>

          {event.location && <div>📍 {event.location}</div>}
          {event.guests && <div>👥 {event.guests}</div>}
          {event.notes && <div>📝 {event.notes}</div>}

          <textarea
            placeholder="Reflection or thoughts..."
            value={journalText}
            onChange={(e) => setJournalText(e.target.value)}
          />

          <button onClick={saveReflection} className="save-reflection-btn">
            Save Reflection
          </button>
        </div>
      )}
    </div>
  );
};

export default EventBlock;
