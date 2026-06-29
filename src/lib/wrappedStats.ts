/**
 * wrappedStats.ts — aggregate "Stitching Wrapped" stats from store + localStorage.
 *
 * Designed to be cheap: reads from already-loaded state, no async calls.
 */

import type { StitchifyState } from '../store';
import { loadStreakData } from './streaks';

export interface WrappedStats {
  totalStitchesDone: number;      // all-time from streak engine
  currentStreak: number;
  bestStreak: number;
  projectCount: number;           // saved projects count
  completedProjects: number;      // projects at 100% progress
  topColors: TopColor[];          // up to 5 most-used colors in current project
  patternSize: string;            // e.g. "120×80"
  projectName: string;
  year: number;
}

export interface TopColor {
  hex: string;
  code: string;
  name: string;
  count: number;
}

export function computeWrappedStats(s: StitchifyState): WrappedStats {
  const streak = loadStreakData();
  const year = new Date().getFullYear();

  // Project stats
  const projectCount = s.savedProjects.length;
  const completedProjects = s.savedProjects.filter((p) => (p.progress ?? 0) >= 1).length;

  // Top colors from current pattern
  const topColors: TopColor[] = [];
  if (s.pattern && s.projectPalette.length > 0) {
    const { matrix, width, height } = s.pattern;
    const freq = new Map<number, number>();
    for (let i = 0; i < width * height; i++) {
      freq.set(matrix[i], (freq.get(matrix[i]) ?? 0) + 1);
    }
    const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    for (const [dmcIdx, count] of sorted) {
      const entry = s.projectPalette.find((p) => p.dmcIndex === dmcIdx);
      if (entry) {
        topColors.push({
          hex: entry.color.hex,
          code: entry.color.code,
          name: entry.color.name,
          count,
        });
      }
    }
  }

  const patternSize =
    s.activeProject.name
      ? `${s.pattern.width}×${s.pattern.height}`
      : '';

  return {
    totalStitchesDone: streak.allTimeCount ?? 0,
    currentStreak:     streak.current,
    bestStreak:        streak.best,
    projectCount,
    completedProjects,
    topColors,
    patternSize,
    projectName: s.activeProject.name || 'Stitchify',
    year,
  };
}
