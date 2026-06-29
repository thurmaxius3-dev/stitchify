import type { DmcColor } from './dmcColors';

export interface Pattern {
  width: number;
  height: number;
  originX: number;
  originY: number;
  matrix: Uint16Array;
  activeDmcIndices?: number[] | null;
  doneMatrix?: Uint8Array | null;
}

export interface PaletteEntry {
  dmcIndex: number;
  color: DmcColor;
  count: number;
  symbol: string;
}

export interface ActiveProject {
  name: string;
  readOnly?: boolean;
  width: number;
  height: number;
  colorSystem: string;
  colorCount: number;
  progress?: number;
  stitched?: number;
  total?: number;
}

export type TabId = 'edit' | 'palette' | 'view' | 'share';
export type ToolId = 'marker' | 'eyedropper' | 'pencil' | 'wand' | 'bucket' | 'section';

export interface PatternSection {
  id: string;
  name: string;
  x: number;   // column (0-based)
  y: number;   // row (0-based)
  w: number;   // width in stitches
  h: number;   // height in stitches
  color: string; // hex color for the overlay
}
export type ViewMode = 'solid' | 'symbol-color' | 'chart';
export type GridMode = 'none' | 'light' | 'heavy' | 'red' | 'combined';
export type SymbolStyle = 'x' | 'circle';
export type SubviewId =
  | 'open-pattern'
  | 'new-pattern'
  | 'import-pattern'
  | 'threads-library'
  | 'calculator'
  | 'settings'
  | 'export-pattern'
  | 'upgrade-pro'
  | null;

export interface FabricPreset {
  label: string;
  count: number;
}

export interface MockProject {
  id: string;
  name: string;
  width: number;
  height: number;
  colorSystem: string;
  colorCount: number;
  progress: number;
  stitched: number;
  total: number;
  seed: number;
}

export interface HistoryEntry {
  x: number;
  y: number;
  from: number;
  to: number;
  kind: 'done' | 'paint';
  fromColor?: number;
  toColor?: number;
  fillCells?: { x: number; y: number; fromColor: number }[]; // for flood fill
}
