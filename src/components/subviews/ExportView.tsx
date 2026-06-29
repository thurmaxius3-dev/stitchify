import { useState } from 'react';
import { useStore } from '../../store';
import SubviewHeader from './SubviewHeader';

export default function ExportView() {
  const exportPng   = useStore((s) => s.exportPng);
  const exportJson  = useStore((s) => s.exportJson);
  const pattern     = useStore((s) => s.pattern);
  const activeProject = useStore((s) => s.activeProject);

  const [pngCell, setPngCell]     = useState(4);
  const [showDone, setShowDone]   = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  const megapixels = ((pattern.width * pngCell) * (pattern.height * pngCell) / 1_000_000).toFixed(1);

  function doExportPng() {
    setExporting('png');
    // Defer so UI updates first
    setTimeout(() => {
      exportPng(pngCell, showDone);
      setExporting(null);
    }, 50);
  }

  function doExportJson() {
    setExporting('json');
    setTimeout(() => {
      exportJson();
      setExporting(null);
    }, 50);
  }

  return (
    <div className="subview-overlay">
      <div className="subview-panel">
        <SubviewHeader title="Export" />

        <div className="subview-body flex flex-col gap-5 p-4">

          {/* ── PNG Export ─────────────────────────────────── */}
          <section className="export-section">
            <h3 className="export-section-title">Export as PNG</h3>
            <p className="export-section-desc">
              Full-color pattern image — each stitch is one square.
            </p>

            <div className="flex items-center gap-3 mt-3">
              <label className="text-sm text-gray-600 flex-shrink-0">Cell size</label>
              <input
                type="range" min={2} max={12} step={1}
                value={pngCell}
                onChange={(e) => setPngCell(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm font-mono w-8 text-center">{pngCell}px</span>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <input
                id="show-done"
                type="checkbox"
                checked={showDone}
                onChange={(e) => setShowDone(e.target.checked)}
              />
              <label htmlFor="show-done" className="text-sm text-gray-600 cursor-pointer">
                Show completed stitches (X marks)
              </label>
            </div>

            <p className="text-xs text-gray-400 mt-1">
              Output: {pattern.width * pngCell} × {pattern.height * pngCell} px &nbsp;·&nbsp; {megapixels} MP
            </p>

            <button
              className="btn-primary mt-3 w-full"
              onClick={doExportPng}
              disabled={exporting === 'png'}
            >
              {exporting === 'png' ? 'Generating…' : `Download PNG`}
            </button>
          </section>

          <hr className="border-gray-200" />

          {/* ── JSON Backup ────────────────────────────────── */}
          <section className="export-section">
            <h3 className="export-section-title">Backup / Transfer</h3>
            <p className="export-section-desc">
              Save your pattern + all progress as a <code>.stitch.json</code> file.
              Transfer to another device by importing this file — protects against
              browser storage being cleared.
            </p>

            <button
              className="btn-secondary mt-3 w-full"
              onClick={doExportJson}
              disabled={exporting === 'json'}
            >
              {exporting === 'json' ? 'Saving…' : `Save "${activeProject?.name ?? 'pattern'}.stitch.json"`}
            </button>
          </section>

        </div>
      </div>
    </div>
  );
}
