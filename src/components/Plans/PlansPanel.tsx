import React, { useMemo, useState } from 'react';
import type { PlannedBlock, Goal, Constraints } from '../Goals/types';
import './PlansPanel.css';

type Props = {
  open: boolean;
  onClose: () => void;

  planned: PlannedBlock[];
  onRemove?: (id: string) => void;

  goals?: Goal[];
  goalConstraints?: Record<string, Constraints>;
  onRemoveGoal?: (goalId: string) => void;

  /** Called when the user logs minutes toward a task */
  onLogTask?: (args: {
    goalId: string;
    milestoneId: string;
    taskId: string;
    deltaMins: number;
  }) => void;
};

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  const hh = d.getHours() % 12 || 12;
  const mm = String(d.getMinutes()).padStart(2, '0');
  const am = d.getHours() < 12 ? 'AM' : 'PM';
  return `${hh}:${mm}${am}`;
};

const dateKey = (iso: string) => {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const weekdayLabel = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const Chip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="meta-chip">{children}</span>
);

const PlansPanel: React.FC<Props> = ({
  open,
  onClose,
  planned,
  onRemove,
  goals = [],
  goalConstraints = {},
  onRemoveGoal,
  onLogTask,
}) => {
  // group blocks by goal id
  const blocksByGoal = useMemo(() => {
    const m = new Map<string, PlannedBlock[]>();
    for (const b of planned) {
      if (!b.goalId) continue;
      const arr = m.get(b.goalId) ?? [];
      arr.push(b);
      m.set(b.goalId, arr);
    }
    for (const [gid, arr] of m) {
      arr.sort((a, b) => +new Date(a.startISO) - +new Date(b.startISO));
      m.set(gid, arr);
    }
    return m;
  }, [planned]);

  // orphan blocks (without goalId)
  const dateGroupedOrphans = useMemo(() => {
    const map = new Map<string, PlannedBlock[]>();
    for (const p of planned) {
      if (p.goalId) continue;
      const k = dateKey(p.startISO);
      const arr = map.get(k) ?? [];
      arr.push(p);
      map.set(k, arr);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(
        ([k, arr]) =>
          [
            k,
            arr.sort((x, y) => +new Date(x.startISO) - +new Date(y.startISO)),
          ] as const
      );
  }, [planned]);

  // accordion
  const [openGoalId, setOpenGoalId] = useState<string | null>(null);

  // local input state per task (minutes to log on next click)
  const [logInputs, setLogInputs] = useState<Record<string, number>>({});

  const bump = (taskId: string, delta: number) =>
    setLogInputs((m) => ({
      ...m,
      [taskId]: Math.max(0, (m[taskId] ?? 0) + delta),
    }));

  const setVal = (taskId: string, v: number) =>
    setLogInputs((m) => ({ ...m, [taskId]: Math.max(0, v) }));

  const submitLog = (goalId: string, milestoneId: string, taskId: string) => {
    const mins = Math.max(0, Math.floor(logInputs[taskId] ?? 0));
    if (!mins) return;
    onLogTask?.({ goalId, milestoneId, taskId, deltaMins: mins });
    setLogInputs((m) => ({ ...m, [taskId]: 0 })); // clear after logging
  };

  const hasGoalsOrBlocks = goals.length > 0 || planned.length > 0;

  return (
    <div
      className={`plans-overlay ${open ? 'show' : ''}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside className="plans-panel" onMouseDown={(e) => e.stopPropagation()}>
        <header className="plans-header">
          <h3>Saved Plans</h3>
          <button className="plans-close" onClick={onClose}>
            ×
          </button>
        </header>

        {/* ⬇️ All scrollable content lives here */}
        <div className="plans-content">
          {!hasGoalsOrBlocks && (
            <div className="plans-empty">No saved goals or blocks yet.</div>
          )}

          {/* === GOAL CARDS === */}
          {goals.map((g) => {
            const blocks = blocksByGoal.get(g.id) ?? [];
            const constraints = goalConstraints[g.id];
            const isOpen = openGoalId === g.id;

            const blockMins = constraints?.blockMins ?? undefined;
            const bufferMins = constraints?.bufferMins ?? undefined;

            return (
              <section
                key={g.id}
                className={`goal-card ${isOpen ? 'expanded' : ''}`}
              >
                <button
                  className="goal-head"
                  onClick={() =>
                    setOpenGoalId((id) => (id === g.id ? null : g.id))
                  }
                  aria-expanded={isOpen}
                >
                  <div className="goal-title">{g.title}</div>
                  <div className="goal-dates">
                    {new Date(g.startDateISO).toLocaleDateString()} –{' '}
                    {new Date(g.deadlineISO).toLocaleDateString()}
                  </div>
                  <div className="goal-meta">
                    {typeof blockMins === 'number' && (
                      <Chip>Block {blockMins}m</Chip>
                    )}
                    {typeof bufferMins === 'number' && (
                      <Chip>Buffer {bufferMins}m</Chip>
                    )}
                    <Chip>{blocks.length} blocks</Chip>
                  </div>
                  <i className="fas fa-chevron-down caret" aria-hidden="true" />
                </button>

                {isOpen && (
                  <div className="goal-body">
                    {/* Working hours */}
                    {constraints && (
                      <div className="goal-section">
                        <div className="section-title">Working hours</div>
                        <div className="wh-grid">
                          {Array.from({ length: 7 }).map((_, idx) => {
                            const windowOrNull =
                              constraints.workingHours[idx] ?? null;
                            return (
                              <div className="wh-row" key={idx}>
                                <span className="wh-day">
                                  {weekdayLabel[idx]}
                                </span>
                                <span
                                  className={`wh-chip ${
                                    windowOrNull ? 'on' : 'off'
                                  }`}
                                >
                                  {windowOrNull
                                    ? `${windowOrNull.start}–${windowOrNull.end}`
                                    : 'Off'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Milestones & tasks with logging */}
                    <div className="goal-section">
                      <div className="section-title">
                        Milestones &amp; tasks
                      </div>
                      {g.milestones.length === 0 && (
                        <div className="muted">No milestones.</div>
                      )}

                      {g.milestones.map((ms) => (
                        <div key={ms.id} className="milestone">
                          <div className="milestone-title">{ms.title}</div>

                          {ms.tasks.length === 0 && (
                            <div className="muted small">No tasks.</div>
                          )}

                          <ul className="task-list">
                            {ms.tasks.map((t) => {
                              const total = Math.max(0, t.estimateMins);
                              const logged = Math.min(
                                total,
                                Math.max(0, t.loggedMins ?? 0)
                              );
                              const pct = total
                                ? Math.min(
                                    100,
                                    Math.round((logged / total) * 100)
                                  )
                                : 0;

                              return (
                                <li key={t.id} className="task-item task-card">
                                  <div className="task-head">
                                    <span
                                      className="task-color"
                                      style={{
                                        background:
                                          t.color || 'var(--plan-default)',
                                      }}
                                    />
                                    <span className="task-name">{t.title}</span>
                                    <span className="task-total">
                                      {logged}m / {total}m
                                    </span>
                                  </div>

                                  <div
                                    className="task-progress"
                                    aria-label="progress"
                                  >
                                    <div
                                      className="task-progress-bar"
                                      style={{ width: `${pct}%` }}
                                      role="progressbar"
                                      aria-valuemin={0}
                                      aria-valuemax={100}
                                      aria-valuenow={pct}
                                    />
                                  </div>

                                  <div className="task-controls">
                                    <button
                                      type="button"
                                      className="log-chip"
                                      onClick={() => bump(t.id, 15)}
                                    >
                                      +15m
                                    </button>
                                    <button
                                      type="button"
                                      className="log-chip"
                                      onClick={() => bump(t.id, 30)}
                                    >
                                      +30m
                                    </button>
                                    <button
                                      type="button"
                                      className="log-chip"
                                      onClick={() => bump(t.id, 60)}
                                    >
                                      +60m
                                    </button>

                                    <input
                                      type="number"
                                      min={0}
                                      step={5}
                                      className="log-input"
                                      value={logInputs[t.id] ?? 0}
                                      onChange={(e) =>
                                        setVal(
                                          t.id,
                                          Number(e.target.value || 0)
                                        )
                                      }
                                      aria-label="minutes to log"
                                    />

                                    <button
                                      type="button"
                                      className="log-btn"
                                      onClick={() =>
                                        submitLog(g.id, ms.id, t.id)
                                      }
                                    >
                                      Log
                                    </button>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>

                    {/* Scheduled blocks */}
                    <div className="goal-section">
                      <div className="section-title">Scheduled blocks</div>
                      {blocks.length === 0 && (
                        <div className="muted">No blocks scheduled yet.</div>
                      )}
                      <ul className="blocks-list">
                        {blocks.map((b) => (
                          <li key={b.id} className="block-item">
                            <span
                              className="block-color"
                              style={{
                                background: b.color || 'var(--plan-default)',
                              }}
                            />
                            <div className="block-main">
                              <div className="block-title">{b.title}</div>
                              <div className="block-time">
                                {new Date(b.startISO).toLocaleDateString()} —{' '}
                                {fmtTime(b.startISO)}–{fmtTime(b.endISO)}
                              </div>
                              {(b.milestoneTitle || b.taskTitle) && (
                                <div className="block-lineage">
                                  {b.milestoneTitle && (
                                    <Chip>{b.milestoneTitle}</Chip>
                                  )}
                                  {b.taskTitle && (
                                    <Chip>{b.taskTitle}</Chip>
                                  )}
                                </div>
                              )}
                            </div>
                            {onRemove && (
                              <button
                                className="plans-delete"
                                onClick={() => onRemove(b.id)}
                                aria-label="Remove planned block"
                              >
                                ✕
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Delete goal */}
                    {onRemoveGoal && (
                      <div className="goal-actions">
                        <button
                          className="danger"
                          onClick={() => onRemoveGoal(g.id)}
                        >
                          Delete Goal &amp; Blocks
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}

          {/* Legacy orphan blocks (no goalId) */}
          {dateGroupedOrphans.length > 0 && (
            <>
              <div className="plans-sep" />
              {dateGroupedOrphans.map(([k, items]) => (
                <section key={k} className="plans-day">
                  <h4>
                    {new Date(k).toLocaleDateString(undefined, {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </h4>
                  <ul className="plans-list">
                    {items.map((p) => (
                      <li key={p.id} className="plans-item">
                        <span
                          className="plans-color"
                          style={{
                            background: p.color || 'var(--plan-default)',
                          }}
                        />
                        <div className="plans-main">
                          <div className="plans-title">{p.title}</div>
                          <div className="plans-time">
                            {fmtTime(p.startISO)} – {fmtTime(p.endISO)}
                          </div>
                        </div>
                        {onRemove && (
                          <button
                            className="plans-delete"
                            onClick={() => onRemove(p.id)}
                            aria-label="Remove planned block"
                          >
                            ✕
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </>
          )}
        </div>
        {/* /.plans-content */}
      </aside>
    </div>
  );
};

export default PlansPanel;
