import { useStore } from '../store';
import type { SubviewId } from '../lib/types';
import { PlusIcon, ImageIcon, ImportIcon, PaletteIcon, CalculatorIcon, SettingsIcon } from './icons';

const NAV: { id: Exclude<SubviewId, null>; label: string; Icon: typeof PlusIcon }[] = [
  { id: 'new-pattern', label: 'New pattern', Icon: PlusIcon },
  { id: 'open-pattern', label: 'Open pattern', Icon: ImageIcon },
  { id: 'import-pattern', label: 'Import pattern', Icon: ImportIcon },
  { id: 'threads-library', label: 'Threads library', Icon: PaletteIcon },
  { id: 'calculator', label: 'Stitch calculator', Icon: CalculatorIcon },
];

export default function LeftDrawer() {
  const open = useStore((s) => s.leftDrawerOpen);
  const set = useStore((s) => s.set);
  const openSubview = useStore((s) => s.openSubview);

  return (
    <>
      <div className={`drawer-overlay${open ? ' open' : ''}`} onClick={() => set({ leftDrawerOpen: false })} />
      <nav className={`left-drawer${open ? ' open' : ''}`}>
        <div className="drawer-header px-4 py-5 relative">
          <span className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
            PRO
          </span>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex gap-0.5">
              <span className="text-yellow-400 font-bold text-lg">&times;</span>
              <span className="text-blue-400 font-bold text-lg">&times;</span>
              <span className="text-green-400 font-bold text-lg">&times;</span>
              <span className="text-orange-400 font-bold text-lg">&times;</span>
            </div>
            <div>
              <div className="text-white font-serif text-sm leading-tight">Stitchify</div>
              <div className="text-white/70 text-xs">for cross-stitch</div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {NAV.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              className="w-full flex items-center gap-4 px-5 py-3 hover:bg-gray-100 text-left"
              onClick={() => openSubview(id)}
            >
              <Icon className="w-5 h-5 text-gray-500" />
              <span className="text-gray-800">{label}</span>
            </button>
          ))}
        </div>

        <div className="border-t border-gray-200 py-2">
          <button
            type="button"
            className="w-full flex items-center gap-4 px-5 py-3 hover:bg-gray-100 text-left"
            onClick={() => openSubview('settings')}
          >
            <SettingsIcon className="w-5 h-5 text-gray-500" />
            <span className="text-gray-800">Settings</span>
          </button>
        </div>
      </nav>
    </>
  );
}
