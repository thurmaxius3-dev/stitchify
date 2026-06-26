import { useMemo, useState } from 'react';
import { useStore } from '../store';
import type { PaletteEntry } from '../lib/types';

function SearchIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
    </svg>
  );
}

const PALETTE_SORTS = [
  { id: 'count-desc', label: 'Most stitches' },
  { id: 'count-asc', label: 'Fewest stitches' },
  { id: 'progress-asc', label: 'Least done first' },
  { id: 'progress-desc', label: 'Most done first' },
  { id: 'num-asc', label: 'DMC # low\u2192high' },
  { id: 'num-desc', label: 'DMC # high\u2192low' },
] as const;

function numKey(entry: PaletteEntry): number {
  const m = String(entry.color.code).match(/\d+/);
  return m ? parseInt(m[0], 10) : -1;
}

function SwapIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8 7h12m0 0l-4-4m4 4l-4 4M16 17H4m0 0l4 4m-4-4l4-4" />
    </svg>
  );
}

export default function PaletteDropdown() {
  const palette = useStore((s) => s.projectPalette);
  const activeColorId = useStore((s) => s.activeColorId);
  const setActiveColor = useStore((s) => s.setActiveColor);
  const swapColor = useStore((s) => s.swapColor);
  const openSubview = useStore((s) => s.openSubview);
  const doneStitches = useStore((s) => s.doneStitches);
  const pattern = useStore((s) => s.pattern);
  const [sortIndex, setSortIndex] = useState(0);
  // null = not swapping, string = the colorId we're swapping FROM
  const [swapFromId, setSwapFromId] = useState<string | null>(null);

  // Count done stitches per DMC index
  const donePerColor = useMemo(() => {
    const map = new Map<number, number>();
    const { width, height, matrix } = pattern;
    for (let i = 0; i < width * height; i++) {
      if (doneStitches[i] === 1) {
        const dmcIndex = matrix[i];
        map.set(dmcIndex, (map.get(dmcIndex) ?? 0) + 1);
      }
    }
    return map;
  }, [doneStitches, pattern]);

  const sorted = useMemo(() => {
    const mode = PALETTE_SORTS[sortIndex].id;
    return palette.slice().sort((a, b) => {
      const pctA = a.count > 0 ? (donePerColor.get(a.dmcIndex) ?? 0) / a.count : 0;
      const pctB = b.count > 0 ? (donePerColor.get(b.dmcIndex) ?? 0) / b.count : 0;
      switch (mode) {
        case 'count-asc':
          return a.count - b.count || numKey(a) - numKey(b);
        case 'num-asc':
          return numKey(a) - numKey(b) || a.color.code.localeCompare(b.color.code);
        case 'num-desc':
          return numKey(b) - numKey(a) || a.color.code.localeCompare(b.color.code);
        case 'progress-asc':
          return pctA - pctB || b.count - a.count;
        case 'progress-desc':
          return pctB - pctA || b.count - a.count;
        case 'count-desc':
        default:
          return b.count - a.count || numKey(a) - numKey(b);
      }
    });
  }, [palette, sortIndex, donePerColor]);

  function handleRowClick(colorId: string) {
    if (swapFromId === null) {
      // Normal mode — select color
      setActiveColor(colorId);
    } else if (swapFromId === colorId) {
      // Tapped the same color — cancel swap
      setSwapFromId(null);
    } else {
      // Complete the swap
      swapColor(swapFromId, colorId);
      setSwapFromId(null);
    }
  }

  function handleSwapBtn(e: React.MouseEvent, colorId: string) {
    e.stopPropagation();
    setSwapFromId((prev) => (prev === colorId ? null : colorId));
  }

  const isSwapping = swapFromId !== null;

  return (
    <div className="palette-dropdown" role="menu" aria-label="Project colors" onClick={(e) => e.stopPropagation()}>
      <div className="palette-dropdown-header">
        {isSwapping ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ background: palette.find((p) => p.color.id === swapFromId)?.color.hex ?? '#ccc' }}
            />
            <span className="text-teal-700 font-medium text-xs truncate">
              Pick a color to swap in
            </span>
            <button
              type="button"
              className="ml-auto text-xs text-gray-400 hover:text-gray-600 flex-shrink-0"
              onClick={() => setSwapFromId(null)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <span className="truncate flex-1 min-w-0">Colors in project</span>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                className="palette-sort-btn palette-search-btn"
                aria-label="Find DMC color"
                title="Find a DMC color"
                onClick={() => openSubview('threads-library')}
              >
                <SearchIcon />
              </button>
              <button
                type="button"
                className="palette-sort-btn"
                onClick={() => setSortIndex((i) => (i + 1) % PALETTE_SORTS.length)}
              >
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 7h13M3 12h9M3 17h5M17 7v12m0 0l-3-3m3 3l3-3" />
                </svg>
                <span className="hidden sm:inline">{PALETTE_SORTS[sortIndex].label}</span>
              </button>
            </div>
          </>
        )}
      </div>

      <div className="palette-dropdown-list">
        {sorted.map((entry) => {
          const done = donePerColor.get(entry.dmcIndex) ?? 0;
          const pct = entry.count > 0 ? Math.round((done / entry.count) * 100) : 0;
          const isSwapSource = swapFromId === entry.color.id;
          const isSwapTarget = isSwapping && !isSwapSource;

          return (
            <button
              key={entry.color.id + entry.dmcIndex}
              type="button"
              className={[
                'palette-item',
                !isSwapping && activeColorId === entry.color.id ? 'active' : '',
                isSwapSource ? 'swap-source' : '',
                isSwapTarget ? 'swap-target' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => handleRowClick(entry.color.id)}
              title={isSwapping && !isSwapSource ? `Replace all ${palette.find(p=>p.color.id===swapFromId)?.color.code} with ${entry.color.code}` : undefined}
            >
              <div className="color-dot" style={{ background: entry.color.hex }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">
                  {entry.color.code}
                  {done > 0 && (
                    <span className="ml-1 text-xs font-normal text-teal-600">{pct}%</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 truncate">{entry.color.name}</div>
                <div className="mt-1 h-1 w-full rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className="h-1 rounded-full bg-teal-500 transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <div className="stitch-counter">
                <div className="num">{entry.count.toLocaleString()}</div>
                <div className="text-gray-400">
                  {done > 0 ? `${done.toLocaleString()} done` : `${entry.count.toLocaleString()} left`}
                </div>
              </div>
              {/* Swap button — only visible on hover, hidden during swap mode */}
              {!isSwapping && (
                <button
                  type="button"
                  className="swap-btn"
                  aria-label={`Swap ${entry.color.code} with another color`}
                  title="Swap this color"
                  onClick={(e) => handleSwapBtn(e, entry.color.id)}
                >
                  <SwapIcon />
                </button>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
