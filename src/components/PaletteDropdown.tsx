import { useMemo, useState } from 'react';
import { useStore } from '../store';
import type { PaletteEntry } from '../lib/types';

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

export default function PaletteDropdown() {
  const palette = useStore((s) => s.projectPalette);
  const activeColorId = useStore((s) => s.activeColorId);
  const setActiveColor = useStore((s) => s.setActiveColor);
  const doneStitches = useStore((s) => s.doneStitches);
  const pattern = useStore((s) => s.pattern);
  const [sortIndex, setSortIndex] = useState(0);

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

  return (
    <div className="palette-dropdown" role="menu" aria-label="Project colors" onClick={(e) => e.stopPropagation()}>
      <div className="palette-dropdown-header">
        <span>Colors in project</span>
        <button
          type="button"
          className="palette-sort-btn"
          onClick={() => setSortIndex((i) => (i + 1) % PALETTE_SORTS.length)}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7h13M3 12h9M3 17h5M17 7v12m0 0l-3-3m3 3l3-3"
            />
          </svg>
          <span>{PALETTE_SORTS[sortIndex].label}</span>
        </button>
      </div>
      <div className="palette-dropdown-list">
        {sorted.map((entry) => {
          const done = donePerColor.get(entry.dmcIndex) ?? 0;
          const pct = entry.count > 0 ? Math.round((done / entry.count) * 100) : 0;
          return (
            <button
              key={entry.color.id + entry.dmcIndex}
              type="button"
              className={`palette-item${activeColorId === entry.color.id ? ' active' : ''}`}
              onClick={() => setActiveColor(entry.color.id)}
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
                {/* Progress bar */}
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
            </button>
          );
        })}
      </div>
    </div>
  );
}
