import React, { useMemo, useState } from "react";

import type { Goal, Milestone, Constraints, PlannedBlock } from "./types";
import { scheduleGoal } from "./scheduler";
import type { BusyInterval } from "./scheduler";

// quick id
const uid = () => crypto.randomUUID();

type Props = {
  isOpen: boolean;
  onClose: () => void;
  // existing busy events (so we don’t schedule on top)
  busy?: BusyInterval[];
  // default constraints
  defaultConstraints?: Partial<Constraints>;
  onPlanned: (blocks: PlannedBlock[]) => void;

  /** ✅ NEW: surface the created goal + the constraints used + generated blocks */
  onPlannedGoal?: (goal: Goal, constraints: Constraints, blocks: PlannedBlock[]) => void;
};

const defaultWH = {
  0: null,                        // Sun off
  1: { start: "09:00", end: "17:00" },
  2: { start: "09:00", end: "17:00" },
  3: { start: "09:00", end: "17:00" },
  4: { start: "09:00", end: "17:00" },
  5: { start: "09:00", end: "15:00" },
  6: null,                        // Sat off
} as const;

export const GoalPlanner: React.FC<Props> = ({
  isOpen, onClose, busy = [],
  defaultConstraints,
  onPlanned,
  onPlannedGoal
}) => {
  const [title, setTitle] = useState("");
  const todayISO = useMemo(() => new Date().toISOString().slice(0,10), []);
  const [startISO, setStartISO] = useState(todayISO);
  const [deadlineISO, setDeadlineISO] = useState(todayISO);

  const [milestones, setMilestones] = useState<Milestone[]>([
    { id: uid(), title: "Core", tasks: [{ id: uid(), title: "Auth + Onboarding", estimateMins: 6*60, color:"#4F46E5"}] },
    { id: uid(), title: "Calendar polish", tasks: [{ id: uid(), title: "Week view & shortcuts", estimateMins: 5*60, color:"#22C55E"}] },
  ]);

  const [constraints, setConstraints] = useState<Constraints>({
    workingHours: { ...(defaultConstraints?.workingHours ?? defaultWH) } as any,
    blockMins: defaultConstraints?.blockMins ?? 90,
    bufferMins: defaultConstraints?.bufferMins ?? 10,
    blackoutDates: defaultConstraints?.blackoutDates ?? []
  });

  if (!isOpen) return null;

  const addMilestone = () => setMilestones(ms => [...ms, { id: uid(), title: "New Milestone", tasks: [] }]);
  const addTask = (msId: string) => {
    setMilestones(ms => ms.map(m =>
      m.id === msId
        ? { ...m, tasks: [...m.tasks, { id: uid(), title: "New Task", estimateMins: 60 }] }
        : m
    ));
  };

  const plan = () => {
    const goal: Goal = {
      id: uid(),
      title,
      startDateISO: `${startISO}T00:00:00.000Z`,
      deadlineISO: `${deadlineISO}T23:59:59.999Z`,
      milestones
    };

    const blocks = scheduleGoal(goal, constraints, busy);

    // Existing behavior: return blocks to the app
    onPlanned(blocks);

    // ✅ NEW: also provide the full goal + constraints so Plans Panel can persist/show them
    if (typeof onPlannedGoal === "function") {
      onPlannedGoal(goal, constraints, blocks);
    }

    onClose();
  };

  return (
    <div style={overlay} onMouseDown={onClose}>
      <div style={panel} onMouseDown={e => e.stopPropagation()}>
        <h3 style={{marginTop:0}}>Plan a Goal</h3>

        <label>Goal title</label>
        <input value={title} onChange={e=>setTitle(e.target.value)} style={inp}/>

        <div style={{display:"flex", gap:12}}>
          <div>
            <label>Start date</label>
            <input type="date" value={startISO} onChange={e=>setStartISO(e.target.value)} style={inp}/>
          </div>
          <div>
            <label>Deadline</label>
            <input type="date" value={deadlineISO} onChange={e=>setDeadlineISO(e.target.value)} style={inp}/>
          </div>
        </div>

        <div style={{display:"flex", gap:12}}>
          <div>
            <label>Block (mins)</label>
            <input
              type="number"
              min={15}
              step={15}
              value={constraints.blockMins}
              onChange={e=>setConstraints(c=>({...c, blockMins: Number(e.target.value)}))}
              style={inp}
            />
          </div>
          <div>
            <label>Buffer (mins)</label>
            <input
              type="number"
              min={0}
              step={5}
              value={constraints.bufferMins}
              onChange={e=>setConstraints(c=>({...c, bufferMins: Number(e.target.value)}))}
              style={inp}
            />
          </div>
        </div>

        <div style={{margin:"12px 0"}}>
          <b>Working hours</b> <small>(per weekday)</small>
          <div style={{display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:8, marginTop:6}}>
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d, idx)=> {
              const w = (constraints.workingHours as any)[idx] as {start:string;end:string} | null;
              const toggle = () => setConstraints(c=> {
                const copy = {...c.workingHours};
                (copy as any)[idx] = w ? null : { start:"09:00", end:"17:00" };
                return {...c, workingHours: copy as any};
              });
              return (
                <div key={idx} style={whCell}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                    <span>{d}</span>
                    <button onClick={toggle} style={miniBtn}>{w ? "On" : "Off"}</button>
                  </div>
                  {w && (
                    <div style={{display:"flex", gap:4, marginTop:6}}>
                      <input
                        type="time"
                        value={w.start}
                        onChange={e=>setConstraints(c=>{
                          const copy:any = {...c.workingHours}; copy[idx] = {...copy[idx], start:e.target.value}; return {...c, workingHours: copy};
                        })}
                        style={tiny}
                      />
                      <span>–</span>
                      <input
                        type="time"
                        value={w.end}
                        onChange={e=>setConstraints(c=>{
                          const copy:any = {...c.workingHours}; copy[idx] = {...copy[idx], end:e.target.value}; return {...c, workingHours: copy};
                        })}
                        style={tiny}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{marginTop:8}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <b>Milestones & tasks</b>
            <button onClick={addMilestone} style={btn}>+ Milestone</button>
          </div>

          {milestones.map(ms=>(
            <div key={ms.id} style={msBox}>
              <input
                value={ms.title}
                onChange={e=>setMilestones(arr=>arr.map(m=>m.id===ms.id?{...m, title:e.target.value}:m))}
                style={inp}
              />
              {ms.tasks.map(t=>(
                <div key={t.id} style={{display:"grid", gridTemplateColumns:"1fr 120px 90px", gap:8}}>
                  <input
                    value={t.title}
                    onChange={e=>setMilestones(arr=>arr.map(m=>{
                      if (m.id!==ms.id) return m;
                      return {...m, tasks: m.tasks.map(x=>x.id===t.id?{...x, title:e.target.value}:x)};
                    }))}
                    style={inp}
                  />
                  <input
                    type="number"
                    min={0}
                    step={15}
                    value={t.estimateMins}
                    onChange={e=>setMilestones(arr=>arr.map(m=>{
                      if (m.id!==ms.id) return m;
                      return {...m, tasks: m.tasks.map(x=>x.id===t.id?{...x, estimateMins:Number(e.target.value)}:x)};
                    }))}
                    style={inp}
                  />
                  <input
                    type="color"
                    value={t.color ?? "#4F46E5"}
                    onChange={e=>setMilestones(arr=>arr.map(m=>{
                      if (m.id!==ms.id) return m;
                      return {...m, tasks: m.tasks.map(x=>x.id===t.id?{...x, color:e.target.value}:x)};
                    }))}
                    style={{height:36, borderRadius:8, border:"1px solid rgba(255,255,255,.2)"}}
                  />
                </div>
              ))}
              <button onClick={()=>addTask(ms.id)} style={miniAdd}>+ Task</button>
            </div>
          ))}
        </div>

        <div style={{display:"flex", gap:8, justifyContent:"flex-end", marginTop:12}}>
          <button onClick={onClose} style={btnGhost}>Cancel</button>
          <button onClick={plan} style={btnPrimary}>Plan</button>
        </div>
      </div>
    </div>
  );
};

// ——— inline minimal styles (keep your glassmorphic vibe) ———
const overlay: React.CSSProperties = {
  position:"fixed", inset:0, background:"rgba(0,0,0,.35)", backdropFilter:"blur(8px)",
  display:"flex", alignItems:"center", justifyContent:"center", zIndex: 10000
};
const panel: React.CSSProperties = {
  width: 860, maxHeight: "90vh", overflow:"auto", background:"rgba(255,255,255,.08)",
  border:"1px solid rgba(255,255,255,.2)", borderRadius:16, padding:18, color:"#fff",
  boxShadow:"0 10px 28px rgba(0,0,0,.35)"
};
const inp: React.CSSProperties = {
  width:"100%", height:36, borderRadius:10, border:"1px solid rgba(255,255,255,.2)",
  background:"rgba(255,255,255,.12)", color:"#fff", padding:"0 10px", margin:"6px 0"
};
const tiny: React.CSSProperties = { ...inp, height:32 };
const btn: React.CSSProperties = {
  borderRadius:10, border:"1px solid rgba(255,255,255,.25)", background:"rgba(255,255,255,.10)",
  color:"#fff", padding:"8px 12px", cursor:"pointer"
};
const btnGhost: React.CSSProperties = { ...btn };
const btnPrimary: React.CSSProperties = {
  ...btn, background:"linear-gradient(135deg,#6c5e5e,#847373)", borderColor:"rgba(255,255,255,.35)"
};
const miniBtn: React.CSSProperties = { ...btn, padding:"4px 8px", fontSize:12 };
const miniAdd: React.CSSProperties = { ...btn, marginTop:6, fontSize:13 };
const msBox: React.CSSProperties = { border:"1px solid rgba(255,255,255,.15)", borderRadius:12, padding:10, marginTop:8 };
const whCell: React.CSSProperties = { border:"1px dashed rgba(255,255,255,.15)", borderRadius:10, padding:8 };

export default GoalPlanner;
