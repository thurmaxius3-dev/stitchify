import { useStore } from '../store';

interface Props {
  feature: string;           // human name shown in upgrade modal e.g. "PDF export"
  children: React.ReactNode;
  mode?: 'block' | 'badge';  // block = replace with lock UI; badge = just show PRO badge on child
}

/**
 * ProGate wraps any Pro-only feature.
 *
 * mode="block"  — renders children when Pro, otherwise a locked teaser card
 * mode="badge"  — always renders children but adds a PRO badge overlay;
 *                 clicks on the locked element open the upgrade modal
 */
export default function ProGate({ feature, children, mode = 'block' }: Props) {
  const isPro            = useStore((s) => s.isPro);
  const openUpgradeModal = useStore((s) => s.openUpgradeModal);

  if (isPro) return <>{children}</>;

  if (mode === 'badge') {
    return (
      <div className="relative inline-flex">
        <div className="opacity-60 pointer-events-none select-none">{children}</div>
        <button
          type="button"
          title={`${feature} is a Pro feature`}
          onClick={() => openUpgradeModal(feature)}
          className="absolute inset-0 flex items-center justify-center"
          aria-label={`Unlock ${feature} with Pro`}
        >
          <span className="bg-yellow-400 text-yellow-900 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">
            PRO
          </span>
        </button>
      </div>
    );
  }

  // mode === 'block'
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed border-teal-200 bg-teal-50 text-center cursor-pointer select-none"
      onClick={() => openUpgradeModal(feature)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && openUpgradeModal(feature)}
    >
      <span className="text-3xl">🔒</span>
      <div>
        <p className="font-semibold text-gray-800 text-sm">{feature}</p>
        <p className="text-xs text-gray-500 mt-0.5">Available on Stitchify Pro</p>
      </div>
      <button
        type="button"
        className="px-4 py-2 bg-teal-600 text-white text-xs font-bold rounded-lg hover:bg-teal-700 transition-colors"
        onClick={(e) => { e.stopPropagation(); openUpgradeModal(feature); }}
      >
        Unlock with Pro
      </button>
    </div>
  );
}
