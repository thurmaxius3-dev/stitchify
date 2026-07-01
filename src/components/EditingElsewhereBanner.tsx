import { useStore } from '../store';

/**
 * Shown when another device holds the editing lock on the current project.
 * Covers the canvas with a semi-transparent overlay and offers a "Take over" button.
 */
export function EditingElsewhereBanner() {
  const lockStatus      = useStore((s) => s.lockStatus);
  const takeOver        = useStore((s) => s.takeOverActiveLock);

  if (lockStatus !== 'readonly') return null;

  return (
    <>
      {/* Full-canvas block overlay — prevents any touch/click reaching the canvas */}
      <div
        className="absolute inset-0 z-30 pointer-events-auto"
        style={{ background: 'rgba(15, 10, 40, 0.55)' }}
      />

      {/* Centered card */}
      <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none px-6">
        <div
          className="pointer-events-auto w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center flex flex-col gap-4"
          style={{ background: '#1a0533', color: '#fff', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <div className="text-3xl">🔒</div>

          <div>
            <p className="text-base font-semibold">Editing on another device</p>
            <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
              This pattern is currently open and being edited somewhere else.
              Your changes here are paused to prevent conflicts.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={takeOver}
              className="w-full py-3 rounded-xl font-semibold text-sm"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: '#fff' }}
            >
              Take over editing here
            </button>
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
              The other device will switch to read-only when it next syncs.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
