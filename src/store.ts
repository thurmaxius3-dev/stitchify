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

export const DMC_LIBRARY = DMC_COLORS;
const MAX_UNDO_HISTORY = 20;
const DELETED_PROJECTS_KEY = 'stitchify-deleted-project-ids';

function loadDeletedProjectIds(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function saveDeletedProjectIds(ids: string[]): void {
  localStorage.setItem(DELETED_PROJECTS_KEY, JSON.stringify(ids));
}

export const MOCK_PROJECTS: MockProject[] = [
  {
    id: 'dw60-1',
    name: 'DW60 (1)',
    width: 594,
    height: 860,
    colorSystem: 'DMC',
    colorCount: 214,
    progress: 0.1499,
    stitched: 76550,
    total: 510840,
    seed: 101,
  },
  {
    id: 'dw60',
    name: 'DW60',
    width: 594,
    height: 860,
    colorSystem: 'DMC',
    colorCount: 214,
    progress: 0.1169,
    stitched: 59720,
    total: 510840,
    seed: 42,
  },
];

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

export interface StitchifyState {
  // Pattern + palette
  pattern: Pattern;
  projectPalette: PaletteEntry[];
  symbolMap: Map<number, string>;
  activeProject: ActiveProject;

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

  // Saved patterns list (Open pattern)
  deletedProjectIds: string[];

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
  applyPattern: (pattern: Pattern, meta: Partial<ActiveProject>) => void;
  loadProject: (projectId: string) => void;
  deleteProject: (projectId: string) => void;
  openSubview: (name: SubviewId) => void;
  closeSubview: () => void;
}

const defaultPattern = createDefaultPattern();
const { palette: defaultPalette, symbolMap: defaultSymbolMap } = buildPalette(defaultPattern);

export const useStore = create<StitchifyState>((set, get) => ({
  pattern: defaultPattern,
  projectPalette: defaultPalette,
  symbolMap: defaultSymbolMap,
  activeProject: {
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

  deletedProjectIds: loadDeletedProjectIds(),

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
    const current = doneStitches[i];
    const nextRedo = redoStack.concat({ x: entry.x, y: entry.y, from: current, to: entry.from });
    if (nextRedo.length > MAX_UNDO_HISTORY) nextRedo.shift();
    doneStitches[i] = entry.from;
    set({
      undoStack: undoStack.slice(0, -1),
      redoStack: nextRedo,
      doneVersion: get().doneVersion + 1,
    });
  },

  redo: () => {
    const { undoStack, redoStack, doneStitches, pattern } = get();
    const entry = redoStack[redoStack.length - 1];
    if (!entry) return;
    const i = entry.y * pattern.width + entry.x;
    const current = doneStitches[i];
    const nextUndo = undoStack.concat({ x: entry.x, y: entry.y, from: current, to: entry.to });
    if (nextUndo.length > MAX_UNDO_HISTORY) nextUndo.shift();
    doneStitches[i] = entry.to;
    set({
      redoStack: redoStack.slice(0, -1),
      undoStack: nextUndo,
      doneVersion: get().doneVersion + 1,
    });
  },

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,

  setZoom: (z) => set({ zoom: Math.min(4, Math.max(0.5, z)) }),

  applyPattern: (pattern, meta) => {
    const { palette, symbolMap } = buildPalette(pattern);
    const done = new Uint8Array(pattern.width * pattern.height);
    let doneVersion = get().doneVersion + 1;
    if (pattern.doneMatrix && pattern.doneMatrix.length === done.length) {
      done.set(pattern.doneMatrix);
      doneVersion += 1;
    }
    set({
      pattern,
      projectPalette: palette,
      symbolMap,
      activeProject: {
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
  },

  loadProject: (projectId) => {
    const project = MOCK_PROJECTS.find((p) => p.id === projectId);
    if (!project || get().deletedProjectIds.includes(projectId)) return;
    const pattern = PatternEngine.generateProceduralPattern(
      project.width,
      project.height,
      project.seed,
      DMC_LIBRARY
    ) as Pattern;
    get().applyPattern(pattern, {
      name: project.name,
      progress: project.progress,
      stitched: project.stitched,
      total: project.total,
    });
  },

  deleteProject: (projectId) => {
    const { deletedProjectIds } = get();
    if (deletedProjectIds.includes(projectId)) return;
    const next = deletedProjectIds.concat(projectId);
    saveDeletedProjectIds(next);
    set({ deletedProjectIds: next });
  },

  openSubview: (name) => set({ activeSubview: name, leftDrawerOpen: false }),
  closeSubview: () => set({ activeSubview: null }),
}));

/** Shared done-toggle that records undo history and bumps the version counter. */
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
  const nextUndo = undoStack.concat({ x, y, from, to });
  if (nextUndo.length > MAX_UNDO_HISTORY) nextUndo.shift();
  doneStitches[i] = to;
  set({ undoStack: nextUndo, redoStack: [], doneVersion: get().doneVersion + 1 });
}

export function totalStitches(s: StitchifyState): number {
  return s.pattern.width * s.pattern.height;
}

export function visibleProjects(s: StitchifyState): MockProject[] {
  return MOCK_PROJECTS.filter((p) => !s.deletedProjectIds.includes(p.id));
}
