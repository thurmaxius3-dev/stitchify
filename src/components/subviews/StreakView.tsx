import { useState } from 'react';
import { useStore } from '../../store';

const QUICK_GOALS = [25, 50, 100, 200];

export function StreakView() {
  const streakData      = useStore((s) => s.streakData);
  const dailyGoal       = useStore((s) => s.dailyGoal);
  const setDailyGoal    = useStore((s) => s.setDailyGoal);
  const closeSubview    = useStore((s) => s.closeSubview);

  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(String(dailyGoal));

  const todayDone = streakData.todayCount >= dailyGoal;
  const pct       = Math.min(100, Math.round((streakData.todayCount / Math.max(1, dailyGoal)) * 100));

  function saveGoal() {
    const n = parseInt(inputVal, 10);
    if (!isNaN(n) && n > 0) setDailyGoal(n);
    setEditing(false);
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-800">Streaks &amp; Goals</h2>
        <button
          onClick={closeSubview}
          className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">

        {/* Current streak card */}
        <div className="rounded-2xl p-5 text-center"
          style={{ background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)', color: '#fff' }}>
          <div className="text-5xl mb-1">🔥</div>
          <div className="text-4xl font-bold">{streakData.current}</div>
          <div className="text-sm opacity-90 mt-0.5">
            {streakData.current === 1 ? 'day streak' : 'day streak'}
          </div>
          {streakData.best > 0 && (
            <div className="text-xs opacity-70 mt-2">
              Best ever: {streakData.best} {streakData.best === 1 ? 'day' : 'days'}
            </div>
          )}
        </div>

        {/* Today's progress */}
        <div className="rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Today's progress</span>
            <span className="text-sm font-semibold" style={{ color: todayDone ? '#22c55e' : '#f97316' }}>
              {streakData.todayCount} / {dailyGoal}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: todayDone ? '#22c55e' : 'linear-gradient(90deg, #f97316, #f59e0b)',
              }}
            />
          </div>
          {todayDone && (
            <p className="text-xs text-green-600 mt-2 font-medium">✓ Goal met! Streak secured for today.</p>
          )}
        </div>

        {/* Daily goal setting */}
        <div className="rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">Daily stitch goal</span>
            {!editing && (
              <button
                className="text-xs text-indigo-600 font-medium"
                onClick={() => { setInputVal(String(dailyGoal)); setEditing(true); }}
              >
                Edit
              </button>
            )}
          </div>

          {editing ? (
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min={1}
                max={9999}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveGoal()}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                autoFocus
              />
              <button
                onClick={saveGoal}
                className="btn-primary text-sm px-4 py-2"
              >
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="btn-secondary text-sm px-3 py-2"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="text-3xl font-bold text-gray-800">{dailyGoal}
              <span className="text-sm font-normal text-gray-500 ml-1">stitches / day</span>
            </div>
          )}

          {/* Quick presets */}
          <div className="flex gap-2 mt-3 flex-wrap">
            {QUICK_GOALS.map((g) => (
              <button
                key={g}
                onClick={() => { setDailyGoal(g); setEditing(false); }}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  dailyGoal === g
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="All-time stitches" value={(streakData.allTimeCount ?? 0).toLocaleString()} />
          <StatCard label="Best streak" value={`${streakData.best}d`} />
        </div>

      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-100 p-3 text-center">
      <div className="text-xl font-bold text-gray-800">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}
