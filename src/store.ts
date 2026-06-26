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
  type SavedProject,
} from './lib/db';
import { scheduleAutoSave, flushAutoSave, setCloudUser } from './lib/autoSave';
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
}

const defaultPattern = createDefaultPattern();
const { palette: defaultPalette, symbolMap: defaultSymbolMap } = buildPalette(defaultPattern);

export const useStore = create<StitchifyState>((set, get) => ({
  pattern: defaultPattern,
  projectPalette: defaultPalette,
  symbolMap: defaultSymbolMap,
  activeProject: {
    id: undefined,
    name: 'Project MVP',
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
  showSymbols: true,

  activeColorId: null,
  zoom: 1,
  cellSize: PatternEngine.computeCellSize(defaultPattern.width, defaultPattern.height) as number,

  doneStitches: new Uint8Array(defaultPattern.width * defaultPattern.height),
  doneVersion: 0,
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

  setZoom: (z) => set({ zoom: Math.min(4, Math.max(0.5, z)) }),

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
