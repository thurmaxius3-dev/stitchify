import { useMemo, useRef, useState } from 'react';
import { DMC_LIBRARY, useStore } from '../../store';
import SubviewHeader from './SubviewHeader';

function luminance(hex: string): number {
  return (
    parseInt(hex.slice(1, 3), 16) * 0.299 +
    parseInt(hex.slice(3, 5), 16) * 0.587 +
    parseInt(hex.slice(5, 7), 16) * 0.114
  );
}

export default function ThreadsLibrary() {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const setActiveColor = useStore((s) => s.setActiveColor);
  const swapColor = useStore((s) => s.swapColor);
  const projectPalette = useStore((s) => s.projectPalette);

  // If a color is selected in the palette, we're in "swap target" mode
  const activeColorId = useStore((s) => s.activeColorId);
  const activeEntry = projectPalette.find((p) => p.color.id === activeColorId);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DMC_LIBRARY;
    return DMC_LIBRARY.filter(
      (c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    );
  }, [query]);

  function handleSelect(color: typeof DMC_LIBRARY[0]) {
    // Set as active color — if it's not in the palette yet it will be
    // added automatically on first paint via paintCell
    setActiveColor(color.id);
  }

  function handleSwap(color: typeof DMC_LIBRARY[0]) {
    if (!activeColorId) return;
    const toEntry = projectPalette.find((p) => p.color.id === color.id);
    if (!toEntry) return;
    swapColor(activeColorId, toEntry.color.id);
    useStore.getState().setActiveColor(color.id);
  }

  const isSwapMode = Boolean(activeColorId && activeEntry);

  return (
    <section className="subview">
      <SubviewHeader title="DMC threads" />

      {isSwapMode && (
        <div className="px-3 py-2 bg-teal-50 border-b border-teal-100 flex items-center gap-2">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: activeEntry?.color.hex }} />
          <span className="text-xs text-teal-700 font-medium">
            Tap a color below to swap all <strong>{activeEntry?.color.code}</strong> stitches
          </span>
          <button
            type="button"
            className="ml-auto text-xs text-gray-400 hover:text-gray-600"
            onClick={() => setActiveColor(activeColorId!)}
          >
            Cancel
          </button>
        </div>
      )}

      <div className="p-2 border-b border-gray-200">
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by DMC number or name…"
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-400"
          autoFocus
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {list.length === 0 && (
          <p className="p-6 text-center text-sm text-gray-400">No colors match "{query}"</p>
        )}
        {list.map((c) => {
          const inProject = projectPalette.some((p) => p.color.id === c.id);
          const textClass = luminance(c.hex) > 160 ? 'text-gray-900' : 'text-white';
          return (
            <button
              key={c.id}
              type="button"
              className="dmc-list-row"
              onClick={() => isSwapMode ? handleSwap(c) : handleSelect(c)}
            >
              {/* Swatch */}
              <div
                className="dmc-list-swatch flex-shrink-0"
                style={{ background: c.hex }}
              />
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-800">
                  DMC {c.code}
                  {inProject && (
                    <span className="ml-1.5 text-xs font-normal text-teal-600">in pattern</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 truncate">{c.name}</div>
              </div>
              {/* Hex badge */}
              <div
                className={`text-xs font-mono px-2 py-0.5 rounded flex-shrink-0 ${textClass}`}
                style={{ background: c.hex }}
              >
                {c.hex.toUpperCase()}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
