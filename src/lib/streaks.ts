/**
 * Streak engine — pure logic, no React/Zustand dependencies.
 * All persistence is via localStorage keys defined below.
 */

export const STREAK_KEYS = {
  dailyGoal:    'stitchify_streak_goal',     // number (stitches/day)
  streakData:   'stitchify_streak_data',     // JSON: StreakData
} as const;

/** Persisted shape */
export interface StreakData {
  /** ISO date string 'YYYY-MM-DD' of the last day we recorded progress */
  lastDate: string | null;
  /** Current consecutive-day streak */
  current: number;
  /** All-time best streak */
  best: number;
  /** Stitches marked done today */
  todayCount: number;
  /** Total stitches marked across all time */
  allTimeCount: number;
}

const DEFAULT_DATA: StreakData = {
  lastDate:     null,
  current:      0,
  best:         0,
  todayCount:   0,
  allTimeCount: 0,
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

function daysBetween(a: string, b: string): number {
  const msPerDay = 86_400_000;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / msPerDay);
}

export function loadStreakData(): StreakData {
  try {
    const raw = localStorage.getItem(STREAK_KEYS.streakData);
    if (!raw) return { ...DEFAULT_DATA };
    return { ...DEFAULT_DATA, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_DATA };
  }
}

export function saveStreakData(data: StreakData): void {
  localStorage.setItem(STREAK_KEYS.streakData, JSON.stringify(data));
}

export function loadDailyGoal(): number {
  return parseInt(localStorage.getItem(STREAK_KEYS.dailyGoal) ?? '50', 10) || 50;
}

export function saveDailyGoal(goal: number): void {
  localStorage.setItem(STREAK_KEYS.dailyGoal, String(Math.max(1, goal)));
}

/**
 * Call this whenever a stitch is marked done (delta = +1) or un-done (delta = -1).
 * Returns the updated data AND a milestone string if one was just hit (else null).
 */
export function recordStitchDelta(
  delta: number,
  data: StreakData,
  dailyGoal: number
): { data: StreakData; milestone: string | null } {
  const today = todayStr();
  let updated = { ...data };
  let milestone: string | null = null;

  // Roll over to a new day if needed
  if (updated.lastDate !== today) {
    const prevDate = updated.lastDate;

    if (prevDate === null) {
      // First ever stitch
      updated.current = 0;
    } else {
      const gap = daysBetween(prevDate, today);
      if (gap === 1) {
        // Consecutive day — streak continues (will be confirmed when goal met)
        // Don't increment yet; keep existing streak unless goal was met yesterday
        // We track: if yesterday's count hit the goal, we maintain the chain
        // Since we can't easily know that retroactively here, we trust the
        // streak value was already incremented when the goal was first met yesterday
      } else {
        // Missed a day (or more) — streak broken
        updated.current = 0;
      }
    }

    updated.lastDate = today;
    updated.todayCount = 0; // reset for new day
  }

  // Apply delta
  const prevToday = updated.todayCount;
  updated.todayCount = Math.max(0, prevToday + delta);
  if (delta > 0) updated.allTimeCount = (updated.allTimeCount ?? 0) + delta;

  // Check if we just crossed the daily goal threshold this session
  const crossedGoal = prevToday < dailyGoal && updated.todayCount >= dailyGoal;
  if (crossedGoal) {
    updated.current += 1;
    if (updated.current > updated.best) {
      updated.best = updated.current;
    }
    // Milestone checks
    const milestones = [1, 3, 7, 14, 30, 60, 100, 365];
    if (milestones.includes(updated.current)) {
      milestone = streakMilestoneMessage(updated.current);
    }
  }

  return { data: updated, milestone };
}

function streakMilestoneMessage(streak: number): string {
  const msgs: Record<number, string> = {
    1:   'First day done! Keep it up.',
    3:   '3-day streak! You\'re building a habit.',
    7:   '🔥 One week streak! You\'re on fire.',
    14:  '🔥 Two weeks straight! Incredible focus.',
    30:  '🔥 30-day streak! You\'re a dedicated stitcher.',
    60:  '🔥 60 days! This is becoming legendary.',
    100: '🔥 100-day streak!! You are unstoppable.',
    365: '🔥 One full year of daily stitching!!',
  };
  return msgs[streak] ?? `🔥 ${streak}-day streak!`;
}

/** Returns progress toward today's goal as 0–1 */
export function goalProgress(data: StreakData, dailyGoal: number): number {
  if (dailyGoal <= 0) return 1;
  return Math.min(1, data.todayCount / dailyGoal);
}
