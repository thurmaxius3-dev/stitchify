import { useState } from 'react';
import { useStore } from '../../store';
import { FABRIC_PRESETS, calculate, inchesToCm } from '../../lib/calculator';
import type { CalcResult, CalcUnit } from '../../lib/calculator';
import SubviewHeader from './SubviewHeader';

const UNITS: CalcUnit[] = ['stitch', 'inch', 'cm', 'mm'];

export default function CalculatorView() {
  const project = useStore((s) => s.activeProject);
  const [width, setWidth] = useState(String(project.width));
  const [height, setHeight] = useState(String(project.height));
  const [widthUnit, setWidthUnit] = useState<CalcUnit>('stitch');
  const [heightUnit, setHeightUnit] = useState<CalcUnit>('stitch');
  const [fabricCount, setFabricCount] = useState(18);
  const [threadCover, setThreadCover] = useState(1);
  const [margin, setMargin] = useState(3);
  const [result, setResult] = useState<CalcResult | null>(null);

  const run = () => {
    setResult(
      calculate({
        width: parseFloat(width) || 0,
        height: parseFloat(height) || 0,
        widthUnit,
        heightUnit,
        fabricCount,
        threadCover,
        margin,
      })
    );
  };

  return (
    <section className="subview">
      <SubviewHeader title="Stitch calculator" />
      <div className="flex-1 overflow-y-auto">
        <div className="calc-field">
          <label>Width of embroidery</label>
          <div className="flex gap-2 items-center">
            <input type="number" min={1} value={width} onChange={(e) => setWidth(e.target.value)} className="flex-1" />
            <select className="w-24 text-sm" value={widthUnit} onChange={(e) => setWidthUnit(e.target.value as CalcUnit)}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="calc-field">
          <label>Height of embroidery</label>
          <div className="flex gap-2 items-center">
            <input type="number" min={1} value={height} onChange={(e) => setHeight(e.target.value)} className="flex-1" />
            <select className="w-24 text-sm" value={heightUnit} onChange={(e) => setHeightUnit(e.target.value as CalcUnit)}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="calc-field">
          <label>Fabric</label>
          <select value={fabricCount} onChange={(e) => setFabricCount(parseInt(e.target.value, 10))}>
            {FABRIC_PRESETS.map((f) => (
              <option key={f.label} value={f.count}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div className="calc-field">
          <label>Fabric count</label>
          <input type="number" min={1} value={fabricCount} onChange={(e) => setFabricCount(parseInt(e.target.value, 10) || 1)} />
        </div>
        <div className="calc-field">
          <label>Each stitch covers</label>
          <select value={threadCover} onChange={(e) => setThreadCover(parseInt(e.target.value, 10))}>
            <option value={1}>1 thread</option>
            <option value={2}>2 threads</option>
            <option value={3}>3 threads</option>
          </select>
        </div>
        <div className="calc-field">
          <label>Border margin (inches, each side)</label>
          <input type="number" min={0} step={0.5} value={margin} onChange={(e) => setMargin(parseFloat(e.target.value) || 0)} />
        </div>

        {result && (
          <div className="calc-results">
            <h3 className="font-semibold text-gray-800 mb-3">Results</h3>
            <p>
              <strong>Stitch count:</strong> {result.stitchesW} &times; {result.stitchesH} (
              {result.totalStitches.toLocaleString()} total)
            </p>
            <p>
              <strong>Embroidery size:</strong> {result.embroideryW.toFixed(2)}&quot; &times;{' '}
              {result.embroideryH.toFixed(2)}&quot; ({inchesToCm(result.embroideryW).toFixed(2)} &times;{' '}
              {inchesToCm(result.embroideryH).toFixed(2)} cm)
            </p>
            <p>
              <strong>With {margin}&quot; margins:</strong> {result.withMarginW.toFixed(2)}&quot; &times;{' '}
              {result.withMarginH.toFixed(2)}&quot; ({inchesToCm(result.withMarginW).toFixed(2)} &times;{' '}
              {inchesToCm(result.withMarginH).toFixed(2)} cm)
            </p>
            <p>
              <strong>Fabric:</strong> {result.fabricCount} count, {result.threadCover} thread(s) per stitch
            </p>
          </div>
        )}
      </div>
      <div className="p-4 border-t border-gray-200 flex justify-center">
        <button type="button" className="calc-btn" onClick={run}>
          Calculate
        </button>
      </div>
    </section>
  );
}
