import type { FabricPreset } from './types';

export const FABRIC_PRESETS: FabricPreset[] = [
  { label: 'Canvas Aida 14', count: 14 },
  { label: 'Canvas Aida 16', count: 16 },
  { label: 'Canvas Aida 18', count: 18 },
  { label: 'Canvas Aida 22', count: 22 },
  { label: 'Linen 28', count: 28 },
  { label: 'Linen 32', count: 32 },
];

export type CalcUnit = 'stitch' | 'inch' | 'cm' | 'mm';

const UNIT_TO_INCHES: Record<CalcUnit, number | null> = {
  stitch: null,
  inch: 1,
  cm: 0.393701,
  mm: 0.0393701,
};

export interface CalcInput {
  width: number;
  height: number;
  widthUnit: CalcUnit;
  heightUnit: CalcUnit;
  fabricCount: number;
  threadCover: number;
  margin: number;
}

export interface CalcResult {
  stitchesW: number;
  stitchesH: number;
  totalStitches: number;
  embroideryW: number;
  embroideryH: number;
  withMarginW: number;
  withMarginH: number;
  fabricCount: number;
  threadCover: number;
}

/** Convert a measurement in the given unit to stitch count. */
function toStitches(value: number, unit: CalcUnit, fabricCount: number, threadCover: number): number {
  if (unit === 'stitch') return value;
  const factor = UNIT_TO_INCHES[unit];
  if (factor == null) return value;
  const inches = value * factor;
  return (inches * fabricCount) / threadCover;
}

/** Compute physical embroidery dimensions from stitch counts and fabric setup. */
export function calculate(input: CalcInput): CalcResult {
  const { width, height, widthUnit, heightUnit, fabricCount, threadCover, margin } = input;

  const stitchesW = toStitches(width, widthUnit, fabricCount, threadCover);
  const stitchesH = toStitches(height, heightUnit, fabricCount, threadCover);

  const embroideryW = (stitchesW / fabricCount) * threadCover;
  const embroideryH = (stitchesH / fabricCount) * threadCover;

  return {
    stitchesW: Math.round(stitchesW),
    stitchesH: Math.round(stitchesH),
    totalStitches: Math.round(stitchesW * stitchesH),
    embroideryW,
    embroideryH,
    withMarginW: embroideryW + margin * 2,
    withMarginH: embroideryH + margin * 2,
    fabricCount,
    threadCover,
  };
}

export const inchesToCm = (inches: number): number => inches * 2.54;
