import { useStore } from '../store';
import ProGate from './ProGate';

/**
 * Compact streak widget shown on the WelcomeScreen and optionally in the header.
 * Tapping it opens the streak-goals subview for Pro users.
 */
export function StreakWidget() {
  const isPro        = useStore((s) => s.isPro);
  const streakData   = useStore((s) => s.streakData);
  const dailyGoal    = useStore((s) => s.dailyGoal);
  const openSubview  = useStore((s) => s.openSubview);
  const openUpgrade  = useStore((s) => s.openUpgradeModal);

  const streak    = streakData.current;
  const todayPct  = Math.min(1, streakData.todayCount / Math.max(1, dailyGoal));
  const goalMet   = streakData.todayCount >= dailyGoal;

  function handleTap() {
    if (isPro) {
      openSubview('streak-goals');
    } else {
      openUpgrade('Daily Streaks');
    }
  }

  return (
    <ProGate feature="Daily Streaks" mode="badge">
      <button
        onClick={handleTap}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/80 border border-gray-200 shadow-sm hover:bg-white active:scale-95 transition-transform"
        title={isPro ? 'View streaks & goals' : 'Pro feature — tap to learn more'}
        style={{ minWidth: 0 }}
      >
        {/* Flame icon — filled color when streak active */}
        <span
          className="text-xl leading-none"
          style={{ filter: streak > 0 ? 'none' : 'grayscale(1) opacity(0.4)' }}
        >
          🔥
        </span>

        <div className="flex flex-col items-start leading-none gap-0.5">
          <span className="text-sm font-semibold text-gray-800">
            {streak > 0 ? `${streak} day${streak !== 1 ? 's' : ''}` : 'Start streak'}
          </span>

          {/* Goal progress bar */}
          <div className="w-16 h-1 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${todayPct * 100}%`,
                background: goalMet ? '#22c55e' : '#f97316',
              }}
            />
          </div>

          <span className="text-[10px] text-gray-400">
            {isPro
              ? goalMet
                ? "Today's goal met ✓"
                : `${streakData.todayCount} / ${dailyGoal} today`
              : 'Pro feature'}
          </span>
        </div>
      </button>
    </ProGate>
  );
}
