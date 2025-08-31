import React, { useEffect, useRef, useState } from 'react';

type CalendarMenuProps = {
  onOpenTimeBlock: () => void;
  onOpenGoalPlanner: () => void;
  onOpenPlans: () => void; // ✅ NEW
};

const CalendarMenu: React.FC<CalendarMenuProps> = ({
  onOpenTimeBlock,
  onOpenGoalPlanner,
  onOpenPlans,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const toggleMenu = () => setIsOpen(v => !v);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (isOpen && modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [isOpen]);

  return (
    <>
      <button
        className="calendar-menu-btn"
        id="Calendarmenubtn"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={toggleMenu}
      >
        <i className="fas fa-bars" aria-hidden="true" />
        <span className="sr-only">Calendar menu</span>
      </button>

      <div
        ref={modalRef}
        id="calendarMenuModal"
        role="menu"
        aria-label="Calendar quick menu"
        className={`calendar-menu-modal ${!isOpen ? 'hidden' : ''}`}
      >
        <button className="menu-link" role="menuitem" onClick={() => console.log('Navigate to weather alerts')}>
          <i className="fas fa-exclamation-triangle weather-icon" aria-hidden="true" /> Weather Alerts
        </button>

        <button className="menu-link" role="menuitem" onClick={() => console.log('Navigate to news')}>
          <i className="fas fa-newspaper news-icon" aria-hidden="true" /> Tempo Digest
        </button>

        <button className="menu-link" role="menuitem" onClick={onOpenTimeBlock}>
          <i className="fas fa-calendar-alt calendar-icon" aria-hidden="true" /> Time Block View
        </button>

        {/* ✅ New: Saved Plans */}
        <button className="menu-link" role="menuitem" onClick={onOpenPlans}>
          <i className="fas fa-list-ul" aria-hidden="true" /> Saved Plans
        </button>

        {/* ✅ Optional: Goal Planner here as well */}
        <button className="menu-link" role="menuitem" onClick={onOpenGoalPlanner}>
          <i className="fas fa-bullseye" aria-hidden="true" /> Plan Goal
        </button>
      </div>
    </>
  );
};

export default CalendarMenu;
