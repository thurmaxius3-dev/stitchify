import { useState } from 'react';
import { useStore } from '../store';
import type { SubviewId, PatternSection } from '../lib/types';
import { PlusIcon, ImageIcon, ImportIcon, PaletteIcon, CalculatorIcon, SettingsIcon, TrashIcon, TargetIcon, SectionIcon, SparkleIcon } from './icons';

const NAV: { id: Exclude<SubviewId, null>; label: string; Icon: typeof PlusIcon }[] = [
  { id: 'new-pattern', label: 'New pattern', Icon: PlusIcon },
  { id: 'open-pattern', label: 'Open pattern', Icon: ImageIcon },
  { id: 'import-pattern', label: 'Import pattern', Icon: ImportIcon },
  { id: 'threads-library', label: 'Threads library', Icon: PaletteIcon },
  { id: 'calculator', label: 'Stitch calculator', Icon: CalculatorIcon },
];

export default function LeftDrawer() {
  const open          = useStore((s) => s.leftDrawerOpen);
  const set           = useStore((s) => s.set);
  const openSubview   = useStore((s) => s.openSubview);
  const sections      = useStore((s) => s.sections);
  const jumpToSection = useStore((s) => s.jumpToSection);
  const deleteSection = useStore((s) => s.deleteSection);
  const updateSection = useStore((s) => s.updateSection);
  const doneStitches  = useStore((s) => s.doneStitches);
  const pattern       = useStore((s) => s.pattern);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName]   = useState('');

  function sectionProgress(sec: PatternSection) {
    let done = 0, total = 0;
    for (let y = sec.y; y < sec.y + sec.h && y < pattern.height; y++) {
      for (let x = sec.x; x < sec.x + sec.w && x < pattern.width; x++) {
        total++;
        if (doneStitches[y * pattern.width + x] === 1) done++;
      }
    }
    return total > 0 ? Math.round((done / total) * 100) : 0;
  }

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

          {/* ── Sections list ── */}
          {sections.length > 0 && (
            <div className="mt-2 border-t border-gray-200">
              <div className="flex items-center gap-2 px-5 py-2">
                <SectionIcon className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sections</span>
              </div>
              {sections.map((sec) => {
                const pct = sectionProgress(sec);
                const isEditing = editingId === sec.id;
                return (
                  <div key={sec.id} className="group flex items-center gap-2 px-4 py-2 hover:bg-gray-50">
                    {/* color dot */}
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0 border border-white/30"
                      style={{ background: sec.color }}
                    />

                    {/* name / inline editor */}
                    {isEditing ? (
                      <input
                        autoFocus
                        className="flex-1 text-sm bg-white border border-blue-400 rounded px-1 py-0.5 outline-none"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={() => {
                          if (editName.trim()) updateSection(sec.id, { name: editName.trim() });
                          setEditingId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (editName.trim()) updateSection(sec.id, { name: editName.trim() });
                            setEditingId(null);
                          } else if (e.key === 'Escape') {
                            setEditingId(null);
                          }
                        }}
                      />
                    ) : (
                      <span
                        className="flex-1 text-sm text-gray-800 truncate cursor-pointer"
                        title="Double-click to rename"
                        onDoubleClick={() => {
                          setEditingId(sec.id);
                          setEditName(sec.name);
                        }}
                      >
                        {sec.name}
                      </span>
                    )}

                    {/* progress % */}
                    <span className="text-xs text-gray-400 flex-shrink-0 w-8 text-right">{pct}%</span>

                    {/* jump button */}
                    <button
                      type="button"
                      title="Jump to section"
                      className="flex-shrink-0 p-1 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600"
                      onClick={() => {
                        jumpToSection(sec.id);
                        set({ leftDrawerOpen: false });
                      }}
                    >
                      <TargetIcon className="w-3.5 h-3.5" />
                    </button>

                    {/* delete button */}
                    <button
                      type="button"
                      title="Delete section"
                      className="flex-shrink-0 p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500"
                      onClick={() => deleteSection(sec.id)}
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 py-2">
          {/* Stitching Wrapped */}
          <button
            type="button"
            className="w-full flex items-center gap-4 px-5 py-3 hover:bg-purple-50 text-left"
            onClick={() => openSubview('wrapped')}
          >
            <SparkleIcon className="w-5 h-5 text-purple-500" />
            <span className="text-gray-800 font-medium">Stitching Wrapped</span>
          </button>
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
