import { useMemo, useState } from 'react';
import { useStore, totalStitches } from '../store';
import type { PaletteEntry } from '../lib/types';

const PALETTE_SORTS = [
  { id: 'count-desc', label: 'Most stitches' },
  { id: 'count-asc', label: 'Fewest stitches' },
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
  const total = useStore(totalStitches);
  const [sortIndex, setSortIndex] = useState(0);

  const sorted = useMemo(() => {
    const mode = PALETTE_SORTS[sortIndex].id;
    return palette.slice().sort((a, b) => {
      switch (mode) {
        case 'count-asc':
          return a.count - b.count || numKey(a) - numKey(b);
        case 'num-asc':
          return numKey(a) - numKey(b) || a.color.code.localeCompare(b.color.code);
        case 'num-desc':
          return numKey(b) - numKey(a) || a.color.code.localeCompare(b.color.code);
        case 'count-desc':
        default:
          return b.count - a.count || numKey(a) - numKey(b);
      }
    });
  }, [palette, sortIndex]);

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
        {sorted.map((entry) => (
          <button
            key={entry.color.id + entry.dmcIndex}
            type="button"
            className={`palette-item${activeColorId === entry.color.id ? ' active' : ''}`}
            onClick={() => setActiveColor(entry.color.id)}
          >
            <div className="color-dot" style={{ background: entry.color.hex }} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-800 truncate">{entry.color.code}</div>
              <div className="text-xs text-gray-500 truncate">{entry.color.name}</div>
            </div>
            <div className="stitch-counter">
              <div className="num">{entry.count.toLocaleString()}</div>
              <div>
                {entry.count}/{total.toLocaleString()}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
