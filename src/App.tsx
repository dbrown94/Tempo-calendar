// src/App.tsx
import { useEffect, useState } from 'react';
import FullCalendar from './components/FullCalendar/FullCalendar';
import CalendarMenu from './components/CalendarMenu/CalendarMenu';
import TimeBlock from './components/TimeBlock/TimeBlock';
import WeatherSidebar from './components/WeatherSideBar/WeatherSideBar';
import GoalPlanner from './components/Goals/GoalPlanner';
import PlansPanel from './components/Plans/PlansPanel';
import type { PlannedBlock, Goal, Constraints } from './components/Goals/types';
import './App.css';

const LS_BLOCKS_V1 = 'tempo.plannedBlocks.v1';
const LS_STORE_V2  = 'tempo.planStore.v2';

type PlanStoreV2 = {
  planned: PlannedBlock[];
  goals: Goal[];
  goalConstraints: Record<string, Constraints>;
};

function App() {
  const [isTimeBlockOpen, setIsTimeBlockOpen] = useState(false);
  const [showGoalPlanner, setShowGoalPlanner] = useState(false);
  const [showPlans, setShowPlans] = useState(false);

  const [planned, setPlanned] = useState<PlannedBlock[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalConstraints, setGoalConstraints] = useState<Record<string, Constraints>>({});

  // ---- load (with migration) ----
  useEffect(() => {
    try {
      const v2Raw = localStorage.getItem(LS_STORE_V2);
      if (v2Raw) {
        const store = JSON.parse(v2Raw) as PlanStoreV2;
        setPlanned(store.planned ?? []);
        setGoals(store.goals ?? []);
        setGoalConstraints(store.goalConstraints ?? {});
        return;
      }
      // migrate old blocks-only key
      const v1Raw = localStorage.getItem(LS_BLOCKS_V1);
      if (v1Raw) {
        const v1 = JSON.parse(v1Raw) as PlannedBlock[];
        setPlanned(v1);
      }
    } catch {}
  }, []);

  // ---- persist v2 ----
  useEffect(() => {
    const store: PlanStoreV2 = { planned, goals, goalConstraints };
    try { localStorage.setItem(LS_STORE_V2, JSON.stringify(store)); } catch {}
  }, [planned, goals, goalConstraints]);

  // ---- callbacks ----
  const handlePlannedBlocksOnly = (blocks: PlannedBlock[]) => {
    setPlanned(prev => [...prev, ...blocks]);
    setShowPlans(true);
  };

  const handlePlannedGoal = (goal: Goal, constraints: Constraints, blocks: PlannedBlock[]) => {
    // store goal (if not already there)
    setGoals(prev => (prev.find(g => g.id === goal.id) ? prev : [...prev, goal]));

    // store the constraints used for this goal
    setGoalConstraints(prev => ({ ...prev, [goal.id]: constraints }));

    // store blocks
    setPlanned(prev => [...prev, ...blocks]);

    // open the panel so the user can see it
    setShowPlans(true);
  };

  const removePlanned = (id: string) =>
    setPlanned(prev => prev.filter(p => p.id !== id));

  const removeGoal = (goalId: string) => {
    setGoals(prev => prev.filter(g => g.id !== goalId));
    setPlanned(prev => prev.filter(p => p.goalId !== goalId)); // drop its blocks
    setGoalConstraints(prev => {
      const copy = { ...prev };
      delete copy[goalId];
      return copy;
    });
  };

  // ✅ NEW: allow PlansPanel to log minutes to a specific task
  const logTaskMinutes = ({
    goalId,
    milestoneId,
    taskId,
    deltaMins,
  }: {
    goalId: string;
    milestoneId: string;
    taskId: string;
    deltaMins: number; // positive to add, negative to subtract
  }) => {
    setGoals(prev =>
      prev.map(g => {
        if (g.id !== goalId) return g;
        return {
          ...g,
          milestones: g.milestones.map(ms => {
            if (ms.id !== milestoneId) return ms;
            return {
              ...ms,
              tasks: ms.tasks.map(t => {
                if (t.id !== taskId) return t;
                const current = t.loggedMins ?? 0;
                return { ...t, loggedMins: Math.max(0, current + deltaMins) };
              }),
            };
          }),
        };
      })
    );
  };

  return (
    <div className="tempo-app">
      <CalendarMenu
        onOpenTimeBlock={() => setIsTimeBlockOpen(true)}
        onOpenGoalPlanner={() => setShowGoalPlanner(true)}
        onOpenPlans={() => setShowPlans(true)}
      />

      <FullCalendar plannedBlocks={planned} />

      <TimeBlock
        isOpen={isTimeBlockOpen}
        onClose={() => setIsTimeBlockOpen(false)}
        plannedBlocks={planned}
      />

      <WeatherSidebar />

      {showGoalPlanner && (
        <GoalPlanner
          isOpen={showGoalPlanner}
          onClose={() => setShowGoalPlanner(false)}
          busy={[]}
          onPlanned={handlePlannedBlocksOnly}
          /** feeds PlansPanel with the full record */
          onPlannedGoal={handlePlannedGoal}
        />
      )}

      <PlansPanel
        open={showPlans}
        onClose={() => setShowPlans(false)}
        planned={planned}
        onRemove={removePlanned}
        /** pass the stored goal objects + constraints */
        goals={goals}
        goalConstraints={goalConstraints}
        onRemoveGoal={removeGoal}
        /** ✅ NEW: let the panel update progress when user logs minutes */
        onLogTask={logTaskMinutes}
      />
    </div>
  );
}

export default App;
