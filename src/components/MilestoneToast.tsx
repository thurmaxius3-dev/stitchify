import { useEffect } from 'react';
import { useStore } from '../store';

/**
 * Lightweight full-screen overlay that pops up when a streak milestone is hit.
 * Auto-dismisses after 4 seconds. No modal, no blocking UI.
 */
export function MilestoneToast() {
  const milestone        = useStore((s) => s.streakMilestone);
  const clearMilestone   = useStore((s) => s.clearStreakMilestone);

  useEffect(() => {
    if (!milestone) return;
    const t = setTimeout(clearMilestone, 4000);
    return () => clearTimeout(t);
  }, [milestone, clearMilestone]);

  if (!milestone) return null;

  return (
    <div
      className="fixed inset-0 flex items-end justify-center pointer-events-none z-50"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}
    >
      <div
        className="pointer-events-auto mx-4 px-5 py-4 rounded-2xl shadow-2xl text-center max-w-sm w-full
                   animate-[slideUp_0.35s_cubic-bezier(0.34,1.56,0.64,1)_forwards]"
        style={{
          background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
          color: '#fff',
        }}
        onClick={clearMilestone}
      >
        <p className="text-base font-semibold leading-snug">{milestone}</p>
        <p className="text-xs mt-1 opacity-80">Tap to dismiss</p>
      </div>
    </div>
  );
}
