// components/Goals/scheduler.ts
import type { Goal, Constraints, PlannedBlock, Task, Milestone } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

function asDate(iso: string) { return new Date(iso); }
function clone(d: Date) { return new Date(d.getTime()); }
function setHM(base: Date, hm: string) {
  const [h, m] = hm.split(":").map(Number);
  const d = clone(base); d.setHours(h, m || 0, 0, 0); return d;
}

export type BusyInterval = { startISO: string; endISO: string };

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

// Flatten tasks but keep their milestone lineage
type FlatTask = Task & { milestoneId?: string; milestoneTitle?: string };
function flattenTasksWithLineage(goal: Goal): FlatTask[] {
  const arr: FlatTask[] = [];
  for (const ms of goal.milestones) {
    for (const t of ms.tasks) {
      arr.push({ ...t, milestoneId: ms.id, milestoneTitle: ms.title });
    }
  }
  return arr;
}

export function scheduleGoal(
  goal: Goal,
  constraints: Constraints,
  existingBusy: BusyInterval[] = []
): PlannedBlock[] {
  const start = asDate(goal.startDateISO);
  const deadline = asDate(goal.deadlineISO);
  if (deadline < start) return [];

  const blackout = new Set(constraints.blackoutDates ?? []);
  const tasks = flattenTasksWithLineage(goal).filter(t => t.estimateMins > 0);

  // Precompute busy intervals by dayKey
  const busyByDay = new Map<string, Array<{ s: Date; e: Date }>>();
  for (const b of existingBusy) {
    const s = asDate(b.startISO), e = asDate(b.endISO);
    const dk = dateKey(s);
    const arr = busyByDay.get(dk) ?? [];
    arr.push({ s, e });
    busyByDay.set(dk, arr);
  }
  for (const [, arr] of busyByDay) arr.sort((a, b) => a.s.getTime() - b.s.getTime());

  const results: PlannedBlock[] = [];
  const block = constraints.blockMins * 60_000;
  const buf = constraints.bufferMins * 60_000;

  function fits(dayKey: string, s: Date, e: Date): boolean {
    // existing
    const ex = busyByDay.get(dayKey) ?? [];
    for (const it of ex) if (overlaps(s, e, it.s, it.e)) return false;
    // newly planned
    const plannedToday = results.filter(p => dateKey(asDate(p.startISO)) === dayKey);
    for (const p of plannedToday) {
      const ps = asDate(p.startISO), pe = asDate(p.endISO);
      if (overlaps(s, e, ps, pe)) return false;
    }
    return true;
  }

  const cur = clone(start);
  while (cur <= deadline && tasks.some(t => t.estimateMins > 0)) {
    const dk = dateKey(cur);
    const w = constraints.workingHours[cur.getDay()];
    if (!blackout.has(dk) && w) {
      const dayStart = setHM(cur, w.start);
      const dayEnd   = setHM(cur, w.end);
      let cursor = clone(dayStart);

      while (cursor.getTime() + block <= dayEnd.getTime() && tasks.some(t => t.estimateMins > 0)) {
        const s = clone(cursor);
        const e = new Date(cursor.getTime() + block);

        if (fits(dk, s, e)) {
          const task = tasks.find(t => t.estimateMins > 0)!;
          results.push({
            id: crypto.randomUUID(),
            title: `${task.title} — ${goal.title}`,
            startISO: s.toISOString(),
            endISO: e.toISOString(),
            color: task.color,
            goalId: goal.id,
            milestoneId: task.milestoneId,
            milestoneTitle: task.milestoneTitle,
            taskId: task.id,
            taskTitle: task.title,
          });
          task.estimateMins = Math.max(0, task.estimateMins - constraints.blockMins);
          cursor = new Date(e.getTime() + buf);
        } else {
          const conflicts = (busyByDay.get(dk) ?? []).filter(b => overlaps(s, e, b.s, b.e));
          if (conflicts.length) {
            const latestEnd = conflicts.reduce((m, c) => c.e > m ? c.e : m, conflicts[0].e);
            cursor = new Date(latestEnd.getTime() + buf);
          } else {
            cursor = new Date(cursor.getTime() + 15 * 60_000);
          }
        }
      }
    }
    cur.setDate(cur.getDate() + 1);
  }

  return results;
}
