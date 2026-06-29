import { create } from 'zustand';
import { DMC_COLORS } from './lib/dmcColors';
import { PatternEngine } from './lib/patternEngine';
import type {
  ActiveProject,
  GridMode,
  HistoryEntry,
  MockProject,
  Pattern,
  PaletteEntry,
  PatternSection,
  SubviewId,
  SymbolStyle,
  TabId,
  ToolId,
  ViewMode,
} from './lib/types';
import {
  loadAllProjects,
  saveProject as dbSaveProject,
  deleteProject as dbDeleteProject,
  renameProject as dbRenameProject,
  getLastOpenProjectId,
  saveJournalEntry,
  loadJournalEntries,
  deleteJournalEntry,
  countJournalEntries,
  type SavedProject,
  type JournalEntry,
} from './lib/db';
import { scheduleAutoSave, flushAutoSave, setCloudUser } from './lib/autoSave';
import {
  loadStreakData,
  saveStreakData,
  loadDailyGoal,
  saveDailyGoal,
  recordStitchDelta,
  goalProgress,
  type StreakData,
} from './lib/streaks';
import { supabase, onAuthStateChange } from './lib/supabase';
import type { User } from '@supabase/supabase-js';

export const DMC_LIBRARY = DMC_COLORS;
const MAX_UNDO_HISTORY = 20;

// Keep MOCK_PROJECTS for backward compat / demo fallback
export const MOCK_PROJECTS: MockProject[] = [];

function createDefaultPattern(): Pattern {
  return PatternEngine.generateProceduralPattern(50, 30, 42, DMC_LIBRARY) as Pattern;
}

function buildPalette(pattern: Pattern): { palette: PaletteEntry[]; symbolMap: Map<number, string> } {
  const palette = PatternEngine.buildProjectPalette(
    pattern.matrix,
    DMC_LIBRARY,
    pattern.activeDmcIndices || null
  ) as PaletteEntry[];
  const symbolMap = PatternEngine.buildSymbolMap(palette) as Map<number, string>;
  return { palette, symbolMap };
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Build a SavedProject snapshot from the current store state. */
function buildSnapshot(s: StitchifyState): SavedProject {
  return {
    id: s.activeProject.id ?? generateId(),
    name: s.activeProject.name,
    width: s.pattern.width,
    height: s.pattern.height,
    colorSystem: s.activeProject.colorSystem,
    colorCount: s.activeProject.colorCount,
    progress: s.activeProject.progress ?? 0,
    stitched: s.activeProject.stitched ?? 0,
    total: s.activeProject.total ?? s.pattern.width * s.pattern.height,
    matrix: Array.from(s.pattern.matrix),
    doneMatrix: Array.from(s.doneStitches),
    activeDmcIndices: s.pattern.activeDmcIndices ?? null,
    originX: s.pattern.originX,
    originY: s.pattern.originY,
    updatedAt: Date.now(),
    syncedAt: null,
  };
}

export interface StitchifyState {
  // Pattern + palette
  pattern: Pattern;
  projectPalette: PaletteEntry[];
  symbolMap: Map<number, string>;
  activeProject: ActiveProject & { id?: string };

  // UI chrome
  activeTab: TabId;
  activeTool: ToolId;
  leftDrawerOpen: boolean;
  paletteDropdownOpen: boolean;
  activeSubview: SubviewId;

  // View options
  viewMode: ViewMode;
  gridMode: GridMode;
  symbolStyle: SymbolStyle;
  contrast: number;
  showSymbols: boolean;

  // Interaction
  activeColorId: string | null;
  zoom: number;
  cellSize: number;

  // Progress
  doneStitches: Uint8Array;
  doneVersion: number;
  hasSeenOnboarding: boolean;
  dismissOnboarding: () => void;
  // Pro tier
  isPro: boolean;
  openUpgradeModal: (featureName?: string) => void;
  activateProPreview: () => void; // dev/demo helper — grants pro without payment
  proFeatureContext: string | null; // which feature triggered the upgrade modal

  // Streaks & goals (Pro)
  streakData: StreakData;
  dailyGoal: number;
  streakMilestone: string | null;  // shown as toast, cleared after display
  setDailyGoal: (n: number) => void;
  clearStreakMilestone: () => void;
  goalProgress: () => number;
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];

  // Render bookkeeping
  renderGeneration: number;

  // New-pattern form
  sourceImage: string | null;
  sourceAspectRatio: number | null;
  sourceImageSize: { width: number; height: number } | null;
  newPatternWidth: number;
  newPatternHeight: number;
  newPatternMaxColors: number;
  newPatternDithering: boolean;
  isConverting: boolean;

  // Saved projects list (replaces MOCK_PROJECTS)
  savedProjects: SavedProject[];
  deletedProjectIds: string[]; // kept for compat

  // Auth + cloud
  cloudUser: User | null;
  cloudSyncEnabled: boolean;

  // Actions
  set: (patch: Partial<StitchifyState>) => void;
  setTab: (tab: TabId) => void;
  setTool: (tool: ToolId) => void;
  togglePaletteDropdown: () => void;
  closePaletteDropdown: () => void;
  setGridMode: (mode: GridMode) => void;
  setViewMode: (mode: ViewMode) => void;
  setSymbolStyle: (style: SymbolStyle) => void;
  setContrast: (value: number) => void;
  setActiveColor: (id: string) => void;
  selectColorFromCell: (x: number, y: number) => void;
  getSymbol: (dmcIndex: number) => string;
  toggleStitchDone: (x: number, y: number) => void;
  setStitchDone: (x: number, y: number, done: boolean) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  setZoom: (z: number) => void;
  paintCell: (x: number, y: number) => void;
  floodFill: (x: number, y: number) => void;
  swapColor: (fromColorId: string, toColorId: string) => void;
  applyPattern: (pattern: Pattern, meta: Partial<ActiveProject & { id?: string }>) => void;
  loadProject: (projectId: string) => void;
  deleteProject: (projectId: string) => void;
  renameProject: (projectId: string, newName: string) => Promise<void>;
  duplicateProject: (projectId: string) => Promise<void>;
  openSubview: (name: SubviewId) => void;
  closeSubview: () => void;
  refreshSavedProjects: () => Promise<void>;
  triggerAutoSave: () => void;
  setCloudSync: (enabled: boolean) => void;
  exportPng: (cellSize?: number, showDone?: boolean) => void;
  exportJson: () => void;
  exportPdf: (cellSize?: number, showDone?: boolean) => Promise<void>;
  // Sections
  sections: PatternSection[];
  addSection: (section: Omit<PatternSection, 'id'>) => void;
  updateSection: (id: string, patch: Partial<Omit<PatternSection, 'id'>>) => void;
  deleteSection: (id: string) => void;
  jumpToSection: (id: string) => void;

  // WIP Journal
  journalEntries: JournalEntry[];
  journalLoading: boolean;
  loadJournal: () => Promise<void>;
  addJournalEntry: (blob: Blob, caption: string) => Promise<'ok' | 'limit'>;
  deleteJournalEntryById: (id: string) => Promise<void>;
}
export type { JournalEntry };

// Minimal blank pattern — just a placeholder until a real project loads
const defaultPattern = createDefaultPattern();
const { palette: defaultPalette, symbolMap: defaultSymbolMap } = buildPalette(defaultPattern);

export const useStore = create<StitchifyState>((set, get) => ({
  pattern: defaultPattern,
  projectPalette: defaultPalette,
  symbolMap: defaultSymbolMap,
  activeProject: {
    id: undefined,
    name: '',   // blank — no project loaded yet
    width: defaultPattern.width,
    height: defaultPattern.height,
    colorSystem: 'DMC',
    colorCount: defaultPalette.length,
  },

  activeTab: 'edit',
  activeTool: 'pencil',
  leftDrawerOpen: false,
  paletteDropdownOpen: false,
  activeSubview: null,

  viewMode: 'symbol-color',
  gridMode: 'light',
  symbolStyle: 'circle',
  contrast: 50,
  showSymbols: false,

  activeColorId: null,
  zoom: 1,
  cellSize: PatternEngine.computeCellSize(defaultPattern.width, defaultPattern.height) as number,
  sections: [] as PatternSection[],
  journalEntries: [],
  journalLoading: false,

  doneStitches: new Uint8Array(defaultPattern.width * defaultPattern.height),
  doneVersion: 0,
  hasSeenOnboarding: localStorage.getItem('stitchify_onboarded') === '1',
  dismissOnboarding: () => {
    localStorage.setItem('stitchify_onboarded', '1');
    set({ hasSeenOnboarding: true });
  },
  isPro: localStorage.getItem('stitchify_pro') === '1',
  proFeatureContext: null,
  openUpgradeModal: (featureName) => {
    set({ activeSubview: 'upgrade-pro', proFeatureContext: featureName ?? null });
  },
  activateProPreview: () => {
    localStorage.setItem('stitchify_pro', '1');
    set({ isPro: true, activeSubview: null });
  },

  // Streaks
  streakData: loadStreakData(),
  dailyGoal: loadDailyGoal(),
  streakMilestone: null,
  setDailyGoal: (n) => {
    const clamped = Math.max(1, n);
    saveDailyGoal(clamped);
    set({ dailyGoal: clamped });
  },
  clearStreakMilestone: () => set({ streakMilestone: null }),
  goalProgress: () => {
    const { streakData, dailyGoal } = get();
    return goalProgress(streakData, dailyGoal);
  },
  undoStack: [],
  redoStack: [],

  renderGeneration: 0,

  sourceImage: null,
  sourceAspectRatio: null,
  sourceImageSize: null,
  newPatternWidth: 100,
  newPatternHeight: 100,
  newPatternMaxColors: 50,
  newPatternDithering: false,
  isConverting: false,

  savedProjects: [],
  deletedProjectIds: [],

  cloudUser: null,
  cloudSyncEnabled: false,

  set: (patch) => set(patch),

  setTab: (tab) => set({ activeTab: tab, paletteDropdownOpen: false }),

  setTool: (tool) => set({ activeTool: tool }),

  togglePaletteDropdown: () => set((s) => ({ paletteDropdownOpen: !s.paletteDropdownOpen })),

  closePaletteDropdown: () => {
    if (get().paletteDropdownOpen) set({ paletteDropdownOpen: false });
  },

  setGridMode: (mode) => set({ gridMode: mode }),

  setViewMode: (mode) => set({ viewMode: mode }),

  setSymbolStyle: (style) => set({ symbolStyle: style, showSymbols: true, viewMode: 'symbol-color' }),

  setContrast: (value) => set({ contrast: value }),

  setActiveColor: (id) => set((s) => ({ activeColorId: s.activeColorId === id ? null : id })),

  selectColorFromCell: (x, y) => {
    const { pattern } = get();
    const { width, height, matrix } = pattern;
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const color = DMC_LIBRARY[matrix[y * width + x]];
    set({ activeColorId: color.id, paletteDropdownOpen: false });
  },

  getSymbol: (dmcIndex) => get().symbolMap.get(dmcIndex) || '\u2022',

  toggleStitchDone: (x, y) => {
    const { pattern, doneStitches } = get();
    const { width, height } = pattern;
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const i = y * width + x;
    applyDone(get, set, x, y, doneStitches[i] === 0);
  },

  setStitchDone: (x, y, done) => applyDone(get, set, x, y, done),

  undo: () => {
    const { undoStack, redoStack, doneStitches, pattern } = get();
    const entry = undoStack[undoStack.length - 1];
    if (!entry) return;
    const i = entry.y * pattern.width + entry.x;

    if (entry.kind === 'paint') {
      const newMatrix = new Uint16Array(pattern.matrix);
      if (entry.fillCells) {
        for (const cell of entry.fillCells) {
          newMatrix[cell.y * pattern.width + cell.x] = cell.fromColor;
        }
      } else {
        newMatrix[i] = entry.fromColor!;
      }
      const newPattern = { ...pattern, matrix: newMatrix };
      const { palette, symbolMap } = buildPalette(newPattern);
      const nextRedo = redoStack.concat(entry);
      if (nextRedo.length > MAX_UNDO_HISTORY) nextRedo.shift();
      set({
        pattern: newPattern,
        projectPalette: palette,
        symbolMap,
        renderGeneration: get().renderGeneration + 1,
        undoStack: undoStack.slice(0, -1),
        redoStack: nextRedo,
      });
    } else {
      const current = doneStitches[i];
      const nextRedo = redoStack.concat({ x: entry.x, y: entry.y, from: current, to: entry.from, kind: 'done' });
      if (nextRedo.length > MAX_UNDO_HISTORY) nextRedo.shift();
      doneStitches[i] = entry.from;
      set({
        undoStack: undoStack.slice(0, -1),
        redoStack: nextRedo,
        doneVersion: get().doneVersion + 1,
      });
    }
    get().triggerAutoSave();
  },

  redo: () => {
    const { undoStack, redoStack, doneStitches, pattern } = get();
    const entry = redoStack[redoStack.length - 1];
    if (!entry) return;
    const i = entry.y * pattern.width + entry.x;

    if (entry.kind === 'paint') {
      const newMatrix = new Uint16Array(pattern.matrix);
      if (entry.fillCells) {
        for (const cell of entry.fillCells) {
          newMatrix[cell.y * pattern.width + cell.x] = entry.toColor!;
        }
      } else {
        newMatrix[i] = entry.toColor!;
      }
      const newPattern = { ...pattern, matrix: newMatrix };
      const { palette, symbolMap } = buildPalette(newPattern);
      const nextUndo = undoStack.concat(entry);
      if (nextUndo.length > MAX_UNDO_HISTORY) nextUndo.shift();
      set({
        pattern: newPattern,
        projectPalette: palette,
        symbolMap,
        renderGeneration: get().renderGeneration + 1,
        undoStack: nextUndo,
        redoStack: redoStack.slice(0, -1),
      });
    } else {
      const current = doneStitches[i];
      const nextUndo = undoStack.concat({ x: entry.x, y: entry.y, from: current, to: entry.to, kind: 'done' });
      if (nextUndo.length > MAX_UNDO_HISTORY) nextUndo.shift();
      doneStitches[i] = entry.to;
      set({
        redoStack: redoStack.slice(0, -1),
        undoStack: nextUndo,
        doneVersion: get().doneVersion + 1,
      });
    }
    get().triggerAutoSave();
  },

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,

  setZoom: (z) => {
    // On mobile, cap zoom lower to avoid canvas memory crashes
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const maxZoom = isMobile ? 3 : 5;
    set({ zoom: Math.min(maxZoom, Math.max(0.25, z)) });
  },

  floodFill: (startX, startY) => {
    const { pattern, activeColorId, projectPalette, undoStack } = get();
    if (!activeColorId) return;
    const entry = projectPalette.find((p) => p.color.id === activeColorId);
    if (!entry) return;
    const { width, height, matrix } = pattern;
    if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;
    const targetColor = matrix[startY * width + startX];
    if (targetColor === entry.dmcIndex) return; // already that color

    // BFS flood fill
    const newMatrix = new Uint16Array(matrix);
    const visited = new Uint8Array(width * height);
    const queue: [number, number][] = [[startX, startY]];
    const paintedCells: { x: number; y: number; fromColor: number }[] = [];
    visited[startY * width + startX] = 1;

    while (queue.length > 0) {
      const [x, y] = queue.shift()!;
      const i = y * width + x;
      paintedCells.push({ x, y, fromColor: newMatrix[i] });
      newMatrix[i] = entry.dmcIndex;
      const neighbors: [number, number][] = [[x-1,y],[x+1,y],[x,y-1],[x,y+1]];
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const ni = ny * width + nx;
        if (!visited[ni] && newMatrix[ni] === targetColor) {
          visited[ni] = 1;
          queue.push([nx, ny]);
        }
      }
    }

    if (paintedCells.length === 0) return;

    // Record as a single undo entry (multi-cell fill)
    const fillEntry: HistoryEntry = {
      x: startX, y: startY, from: 0, to: 0,
      kind: 'paint',
      fromColor: targetColor,
      toColor: entry.dmcIndex,
      fillCells: paintedCells,
    };
    const nextUndo = undoStack.concat(fillEntry);
    if (nextUndo.length > MAX_UNDO_HISTORY) nextUndo.shift();

    const newPattern = { ...pattern, matrix: newMatrix };
    const { palette, symbolMap } = buildPalette(newPattern);
    set({
      pattern: newPattern,
      projectPalette: palette,
      symbolMap,
      renderGeneration: get().renderGeneration + 1,
      undoStack: nextUndo,
      redoStack: [],
    });
    get().triggerAutoSave();
  },

  swapColor: (fromColorId, toColorId) => {
    const { pattern, projectPalette, undoStack } = get();
    const fromEntry = projectPalette.find((p) => p.color.id === fromColorId);
    const toEntry = projectPalette.find((p) => p.color.id === toColorId);
    if (!fromEntry || !toEntry || fromEntry.dmcIndex === toEntry.dmcIndex) return;

    const { width, height, matrix } = pattern;
    const newMatrix = new Uint16Array(matrix);
    const paintedCells: { x: number; y: number; fromColor: number }[] = [];

    for (let i = 0; i < width * height; i++) {
      if (newMatrix[i] === fromEntry.dmcIndex) {
        paintedCells.push({ x: i % width, y: Math.floor(i / width), fromColor: fromEntry.dmcIndex });
        newMatrix[i] = toEntry.dmcIndex;
      }
    }
    if (paintedCells.length === 0) return;

    // Single undoable entry for the whole swap
    const swapEntry: HistoryEntry = {
      x: 0, y: 0, from: 0, to: 0,
      kind: 'paint',
      fromColor: fromEntry.dmcIndex,
      toColor: toEntry.dmcIndex,
      fillCells: paintedCells,
    };
    const nextUndo = undoStack.concat(swapEntry);
    if (nextUndo.length > MAX_UNDO_HISTORY) nextUndo.shift();

    const newPattern = { ...pattern, matrix: newMatrix };
    const { palette, symbolMap } = buildPalette(newPattern);
    set({
      pattern: newPattern,
      projectPalette: palette,
      symbolMap,
      renderGeneration: get().renderGeneration + 1,
      undoStack: nextUndo,
      redoStack: [],
    });
    get().triggerAutoSave();
  },

  paintCell: (x, y) => {
    const { pattern, activeColorId, projectPalette, undoStack } = get();
    if (!activeColorId) return;
    const { width, height, matrix } = pattern;
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const entry = projectPalette.find((p) => p.color.id === activeColorId);
    if (!entry) return;
    const i = y * width + x;
    const fromColor = matrix[i];
    if (fromColor === entry.dmcIndex) return; // no change
    const newMatrix = new Uint16Array(matrix);
    newMatrix[i] = entry.dmcIndex;
    const newPattern = { ...pattern, matrix: newMatrix };
    const { palette, symbolMap } = buildPalette(newPattern);
    const nextUndo = undoStack.concat({ x, y, from: 0, to: 0, kind: 'paint', fromColor, toColor: entry.dmcIndex });
    if (nextUndo.length > MAX_UNDO_HISTORY) nextUndo.shift();
    set({
      pattern: newPattern,
      projectPalette: palette,
      symbolMap,
      renderGeneration: get().renderGeneration + 1,
      undoStack: nextUndo,
      redoStack: [],
    });
    get().triggerAutoSave();
  },

  applyPattern: (pattern, meta) => {
    const { palette, symbolMap } = buildPalette(pattern);
    const done = new Uint8Array(pattern.width * pattern.height);
    let doneVersion = get().doneVersion + 1;
    if (pattern.doneMatrix && pattern.doneMatrix.length === done.length) {
      done.set(pattern.doneMatrix);
      doneVersion += 1;
    }
    const id = meta.id ?? generateId();
    set({
      pattern,
      projectPalette: palette,
      symbolMap,
      activeProject: {
        id,
        name: meta.name || 'Pattern',
        width: pattern.width,
        height: pattern.height,
        colorCount: palette.length,
        colorSystem: 'DMC',
        progress: meta.progress,
        stitched: meta.stitched,
        total: meta.total,
      },
      doneStitches: done,
      doneVersion,
      undoStack: [],
      redoStack: [],
      activeColorId: null,
      cellSize: PatternEngine.computeCellSize(pattern.width, pattern.height) as number,
      zoom: 1,
      renderGeneration: get().renderGeneration + 1,
      activeSubview: null,
      sourceImage: null,
    });
    // Trigger save after state settles
    setTimeout(() => get().triggerAutoSave(), 100);
  },

  loadProject: (projectId) => {
    const { savedProjects } = get();
    const project = savedProjects.find((p) => p.id === projectId);
    if (!project) return;
    const matrix = new Uint16Array(project.matrix);
    const pattern: Pattern = {
      width: project.width,
      height: project.height,
      originX: project.originX,
      originY: project.originY,
      matrix,
      activeDmcIndices: project.activeDmcIndices,
      doneMatrix: new Uint8Array(project.doneMatrix),
    };
    get().applyPattern(pattern, {
      id: project.id,
      name: project.name,
      progress: project.progress,
      stitched: project.stitched,
      total: project.total,
    });
  },

  deleteProject: async (projectId) => {
    await dbDeleteProject(projectId);
    set((s) => ({ savedProjects: s.savedProjects.filter((p) => p.id !== projectId) }));
  },

  renameProject: async (projectId, newName) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await dbRenameProject(projectId, trimmed);
    set((s) => ({
      savedProjects: s.savedProjects.map((p) =>
        p.id === projectId ? { ...p, name: trimmed, updatedAt: Date.now() } : p
      ),
      // Also update activeProject name if it's the open one
      activeProject:
        s.activeProject.id === projectId
          ? { ...s.activeProject, name: trimmed }
          : s.activeProject,
    }));
  },

  duplicateProject: async (projectId) => {
    const { savedProjects } = get();
    const source = savedProjects.find((p) => p.id === projectId);
    if (!source) return;
    const newId = generateId();
    const copy: SavedProject = {
      ...source,
      id: newId,
      name: `${source.name} (copy)`,
      updatedAt: Date.now(),
      syncedAt: null,
      // Fresh start — no marked stitches, reset progress counters
      doneMatrix: new Array(source.doneMatrix.length).fill(0),
      progress: 0,
      stitched: 0,
    };
    await dbSaveProject(copy);
    set((s) => ({ savedProjects: [copy, ...s.savedProjects] }));
  },

  openSubview: (name) => set({ activeSubview: name, leftDrawerOpen: false }),
  closeSubview: () => set({ activeSubview: null }),

  refreshSavedProjects: async () => {
    const projects = await loadAllProjects();
    set({ savedProjects: projects });
  },

  triggerAutoSave: () => {
    const s = get();
    if (!s.activeProject.id) return;
    const snapshot = buildSnapshot(s);
    scheduleAutoSave(snapshot);
  },

  setCloudSync: (enabled) => {
    const { cloudUser } = get();
    set({ cloudSyncEnabled: enabled });
    setCloudUser(cloudUser?.id ?? null, enabled);
    localStorage.setItem('stitchify-cloud-sync', enabled ? '1' : '0');
  },

  // ── Section actions ──────────────────────────────────────────────────
  addSection: (section) => {
    const id = `sec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    set((s) => ({ sections: [...s.sections, { ...section, id }] }));
  },

  updateSection: (id, patch) => {
    set((s) => ({
      sections: s.sections.map((sec) => sec.id === id ? { ...sec, ...patch } : sec),
    }));
  },

  deleteSection: (id) => {
    set((s) => ({ sections: s.sections.filter((sec) => sec.id !== id) }));
  },

  // ── WIP Journal ──────────────────────────────────────────────────
  loadJournal: async () => {
    const { activeProject } = get();
    if (!activeProject.id) return;
    set({ journalLoading: true });
    const entries = await loadJournalEntries(activeProject.id);
    set({ journalEntries: entries, journalLoading: false });
  },

  addJournalEntry: async (blob, caption) => {
    const { activeProject, isPro, journalEntries } = get();
    if (!activeProject.id) return 'ok';
    const FREE_LIMIT = 3;
    if (!isPro) {
      // Count entries for this project
      const count = await countJournalEntries(activeProject.id);
      if (count >= FREE_LIMIT) return 'limit';
    }
    const id = `je_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const pct = activeProject.progress ?? 0;
    const entry: JournalEntry = {
      id,
      projectId: activeProject.id,
      blob,
      caption,
      takenAt: Date.now(),
      progress: Math.round(pct * 100),
    };
    await saveJournalEntry(entry);
    set({ journalEntries: [entry, ...journalEntries] });
    return 'ok';
  },

  deleteJournalEntryById: async (id) => {
    await deleteJournalEntry(id);
    set((s) => ({ journalEntries: s.journalEntries.filter((e) => e.id !== id) }));
  },

  jumpToSection: (id) => {
    const { sections, cellSize } = get();
    const sec = sections.find((s) => s.id === id);
    if (!sec) return;
    // Calculate zoom so section fills the scroll container
    const scrollEl = document.querySelector('.canvas-scroll') as HTMLElement | null;
    if (!scrollEl) return;
    const vpW = scrollEl.clientWidth;
    const vpH = scrollEl.clientHeight;
    const zoomW = vpW / (sec.w * cellSize);
    const zoomH = vpH / (sec.h * cellSize);
    const newZoom = Math.min(zoomW, zoomH, 8); // cap at 8x
    set({ zoom: Math.max(0.25, newZoom) });
    // After zoom applied, scroll so section is top-left of viewport
    requestAnimationFrame(() => {
      const cell = cellSize * newZoom;
      scrollEl.scrollLeft = sec.x * cell;
      scrollEl.scrollTop  = sec.y * cell;
    });
  },

  exportPng: (cellSize = 4, showDone = true) => {
    const { pattern, doneStitches, activeProject } = get();
    const { width, height, matrix } = pattern;
    const offscreen = document.createElement('canvas');
    offscreen.width = width * cellSize;
    offscreen.height = height * cellSize;
    const ctx = offscreen.getContext('2d')!;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const color = DMC_LIBRARY[matrix[idx]];
        ctx.fillStyle = color.hex;
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        if (showDone && doneStitches[idx] === 1 && cellSize >= 4) {
          ctx.strokeStyle = 'rgba(0,0,0,0.5)';
          ctx.lineWidth = Math.max(1, cellSize * 0.18);
          const pad = cellSize * 0.2;
          ctx.beginPath();
          ctx.moveTo(x * cellSize + pad, y * cellSize + pad);
          ctx.lineTo(x * cellSize + cellSize - pad, y * cellSize + cellSize - pad);
          ctx.moveTo(x * cellSize + cellSize - pad, y * cellSize + pad);
          ctx.lineTo(x * cellSize + pad, y * cellSize + cellSize - pad);
          ctx.stroke();
        }
      }
    }
    if (cellSize >= 3) {
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx <= width; gx += 10) {
        ctx.beginPath(); ctx.moveTo(gx * cellSize, 0); ctx.lineTo(gx * cellSize, height * cellSize); ctx.stroke();
      }
      for (let gy = 0; gy <= height; gy += 10) {
        ctx.beginPath(); ctx.moveTo(0, gy * cellSize); ctx.lineTo(width * cellSize, gy * cellSize); ctx.stroke();
      }
    }
    offscreen.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeProject?.name ?? 'pattern'}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }, 'image/png');
  },

  exportJson: () => {
    const { pattern, doneStitches, activeProject } = get();
    const data = {
      name: activeProject?.name ?? 'pattern',
      width: pattern.width,
      height: pattern.height,
      matrix: Array.from(pattern.matrix),
      doneMatrix: Array.from(doneStitches),
      activeDmcIndices: pattern.activeDmcIndices ?? null,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeProject?.name ?? 'pattern'}.stitch.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },

  exportPdf: async (cellSize = 12, showDone = true) => {
    const { pattern, doneStitches, activeProject, projectPalette, symbolMap } = get();
    const { width, height, matrix } = pattern;
    const name = activeProject?.name ?? 'pattern';

    const { jsPDF } = await import('jspdf');

    const PAGE_W_MM = 297;
    const PAGE_H_MM = 210;
    const MARGIN_MM = 10;
    const HEADER_MM = 14;
    const MM_PER_PX = 0.264583;

    const cellMm = cellSize * MM_PER_PX;
    const usableW = PAGE_W_MM - MARGIN_MM * 2;
    const usableH = PAGE_H_MM - MARGIN_MM * 2 - HEADER_MM;
    const colsPerPage = Math.floor(usableW / cellMm);
    const rowsPerPage = Math.floor(usableH / cellMm);

    const colorUsage = new Map<string, number>();
    for (let i = 0; i < matrix.length; i++) {
      const c = DMC_LIBRARY[matrix[i]];
      if (c) colorUsage.set(c.id, (colorUsage.get(c.id) ?? 0) + 1);
    }
    const usedColors = projectPalette
      .filter((e) => colorUsage.has(e.color.id))
      .sort((a, b) => (colorUsage.get(b.color.id) ?? 0) - (colorUsage.get(a.color.id) ?? 0));

    function renderTile(
      startCol: number, startRow: number,
      cols: number, rows: number
    ): HTMLCanvasElement {
      const cvs = document.createElement('canvas');
      cvs.width  = cols * cellSize;
      cvs.height = rows * cellSize;
      const ctx = cvs.getContext('2d')!;
      for (let ry = 0; ry < rows; ry++) {
        const py = startRow + ry;
        if (py >= height) break;
        for (let rx = 0; rx < cols; rx++) {
          const px = startCol + rx;
          if (px >= width) continue;
          const idx = py * width + px;
          const dmcIdx = matrix[idx];
          const color = DMC_LIBRARY[dmcIdx];
          const isDone = doneStitches[idx] === 1;
          ctx.fillStyle = color?.hex ?? '#cccccc';
          ctx.fillRect(rx * cellSize, ry * cellSize, cellSize, cellSize);
          if (cellSize >= 8) {
            const sym = symbolMap.get(dmcIdx) ?? '·';
            const fontSize = Math.max(6, cellSize - 4);
            ctx.font = `${fontSize}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const hex = color?.hex ?? '#888888';
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            ctx.fillStyle = lum > 160 ? '#000000' : '#ffffff';
            ctx.fillText(sym, rx * cellSize + cellSize / 2, ry * cellSize + cellSize / 2);
          }
          if (showDone && isDone && cellSize >= 6) {
            ctx.strokeStyle = 'rgba(80,80,80,0.5)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(rx * cellSize + 1, ry * cellSize + 1);
            ctx.lineTo((rx + 1) * cellSize - 1, (ry + 1) * cellSize - 1);
            ctx.moveTo((rx + 1) * cellSize - 1, ry * cellSize + 1);
            ctx.lineTo(rx * cellSize + 1, (ry + 1) * cellSize - 1);
            ctx.stroke();
          }
          ctx.strokeStyle = 'rgba(0,0,0,0.18)';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(rx * cellSize + 0.25, ry * cellSize + 0.25, cellSize - 0.5, cellSize - 0.5);
        }
      }
      return cvs;
    }

    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    let pageNum = 0;
    const hPageCount = Math.ceil(width / colsPerPage);
    const vPageCount = Math.ceil(height / rowsPerPage);
    const totalPages = hPageCount * vPageCount;

    for (let vp = 0; vp < vPageCount; vp++) {
      for (let hp = 0; hp < hPageCount; hp++) {
        if (pageNum > 0) pdf.addPage();
        pageNum++;
        const startCol = hp * colsPerPage;
        const startRow = vp * rowsPerPage;
        const cols = Math.min(colsPerPage, width - startCol);
        const rows = Math.min(rowsPerPage, height - startRow);
        pdf.setFontSize(9);
        pdf.setTextColor(30, 30, 30);
        pdf.setFont('helvetica', 'bold');
        pdf.text(name, MARGIN_MM, MARGIN_MM + 5);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        pdf.setTextColor(100, 100, 100);
        pdf.text(
          `${width}×${height} stitches  ·  cols ${startCol + 1}–${startCol + cols}  ·  rows ${startRow + 1}–${startRow + rows}  ·  page ${pageNum}/${totalPages}`,
          MARGIN_MM, MARGIN_MM + 10
        );
        const tile = renderTile(startCol, startRow, cols, rows);
        const tileMmW = cols * cellMm;
        const tileMmH = rows * cellMm;
        pdf.addImage(tile.toDataURL('image/png'), 'PNG', MARGIN_MM, MARGIN_MM + HEADER_MM, tileMmW, tileMmH);
      }
    }

    // Legend page
    pdf.addPage();
    pdf.setFontSize(11);
    pdf.setTextColor(30, 30, 30);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Color Legend', MARGIN_MM, MARGIN_MM + 8);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(80, 80, 80);
    pdf.text(`${usedColors.length} colors  ·  ${width}×${height}  ·  ${(width * height).toLocaleString()} total stitches`, MARGIN_MM, MARGIN_MM + 14);

    const LEGEND_ROWS = 8;
    const COL_W = 60;
    const ROW_H = 7;
    const SWATCH = 5;
    const LEG_START_Y = MARGIN_MM + 20;
    const COLS_PER_ROW = Math.floor(usableW / COL_W);

    usedColors.forEach((entry, i) => {
      const posInPage = i % (LEGEND_ROWS * COLS_PER_ROW);
      if (i > 0 && posInPage === 0) {
        pdf.addPage();
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 30, 30);
        pdf.text('Color Legend (continued)', MARGIN_MM, MARGIN_MM + 8);
      }
      const col = Math.floor(posInPage / LEGEND_ROWS) % COLS_PER_ROW;
      const row = posInPage % LEGEND_ROWS;
      const x = MARGIN_MM + col * COL_W;
      const y = LEG_START_Y + row * ROW_H;
      const hex = entry.color.hex;
      pdf.setFillColor(parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16));
      pdf.setDrawColor(180, 180, 180);
      pdf.rect(x, y - SWATCH + 1, SWATCH, SWATCH, 'FD');
      const dmcIdx = DMC_LIBRARY.findIndex((c) => c.id === entry.color.id);
      const sym = symbolMap.get(dmcIdx) ?? '·';
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(30, 30, 30);
      pdf.text(sym, x + SWATCH + 1.5, y);
      const cnt = colorUsage.get(entry.color.id) ?? 0;
      pdf.setFontSize(6.5);
      pdf.text(`${entry.color.code}  ${entry.color.name}  (${cnt.toLocaleString()})`, x + SWATCH + 7, y);
    });

    pdf.save(`${name}.pdf`);
  },
}));

/** Shared done-toggle that records undo history, bumps version, and schedules save. */
function applyDone(
  get: () => StitchifyState,
  set: (patch: Partial<StitchifyState>) => void,
  x: number,
  y: number,
  done: boolean
): void {
  const { pattern, doneStitches, undoStack } = get();
  const { width, height } = pattern;
  if (x < 0 || x >= width || y < 0 || y >= height) return;
  const i = y * width + x;
  const from = doneStitches[i];
  const to = done ? 1 : 0;
  if (from === to) return;
  const nextUndo = undoStack.concat({ x, y, from, to, kind: 'done' });
  if (nextUndo.length > MAX_UNDO_HISTORY) nextUndo.shift();
  doneStitches[i] = to;
  set({ undoStack: nextUndo, redoStack: [], doneVersion: get().doneVersion + 1 });

  // ── Streak tracking ──────────────────────────────────────────────────
  const { isPro, streakData, dailyGoal } = get();
  if (isPro) {
    const delta = done ? 1 : -1;
    const { data: newData, milestone } = recordStitchDelta(delta, streakData, dailyGoal);
    saveStreakData(newData);
    const patch: Partial<StitchifyState> = { streakData: newData };
    if (milestone) patch.streakMilestone = milestone;
    set(patch);
  }

  get().triggerAutoSave();
}

export function totalStitches(s: StitchifyState): number {
  return s.pattern.width * s.pattern.height;
}

export function visibleProjects(s: StitchifyState): SavedProject[] {
  return s.savedProjects;
}

// ─── Bootstrap: load saved projects + auth on startup ────────────────────────

async function bootstrap() {
  const store = useStore.getState();

  // Load local projects
  await store.refreshSavedProjects();

  // Restore last open project
  const lastId = await getLastOpenProjectId();
  if (lastId) {
    const { savedProjects } = useStore.getState();
    if (savedProjects.find((p) => p.id === lastId)) {
      useStore.getState().loadProject(lastId);
    }
  }

  // Restore cloud sync preference
  const cloudPref = localStorage.getItem('stitchify-cloud-sync') === '1';

  // Auth state listener
  if (supabase) {
    onAuthStateChange((user) => {
      useStore.setState({ cloudUser: user });
      const enabled = user ? cloudPref : false;
      useStore.getState().setCloudSync(enabled);
    });

    // Check existing session
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        useStore.setState({ cloudUser: data.user });
        useStore.getState().setCloudSync(cloudPref);
      }
    });
  }

  // Flush save on page hide
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      const s = useStore.getState();
      if (s.activeProject.id) {
        flushAutoSave(buildSnapshot(s));
      }
    }
  });
}

bootstrap();
