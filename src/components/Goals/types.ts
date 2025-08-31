// components/Goals/types.ts
export type Goal = {
  id: string;
  title: string;
  startDateISO: string;   // inclusive
  deadlineISO: string;    // inclusive
  milestones: Milestone[];
};

export type Milestone = {
  id: string;
  title: string;
  tasks: Task[];
};

export type Task = {
  id: string;
  title: string;
  estimateMins: number;   // remaining work estimate
  color?: string;
  loggedMins?: number;
};

export type Constraints = {
  workingHours: {
    // 0..6 => Sun..Sat; null means off
    [weekday: number]: { start: string; end: string } | null;
  };
  blockMins: number;
  bufferMins: number;
  blackoutDates: string[]; // ["YYYY-MM-DD"]
};

export type PlannedBlock = {
  id: string;
  title: string;

  // scheduling window
  startISO: string;       // e.g. "2025-09-01T13:00:00.000Z"
  endISO: string;         // e.g. "2025-09-01T14:30:00.000Z"

  // display
  color?: string;

  // lineage (optional, but available if the scheduler supplies them)
  goalId?: string;
  milestoneId?: string;
  milestoneTitle?: string;
  taskId?: string;
  taskTitle?: string;
};

