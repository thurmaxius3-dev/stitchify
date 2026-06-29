import { useState } from 'react';
import { useStore, totalStitches } from '../../store';
import SubviewHeader from './SubviewHeader';
import { createShareLink, supabase } from '../../lib/supabase';

export default function ExportView() {
  const exportPng    = useStore((s) => s.exportPng);
  const exportJson   = useStore((s) => s.exportJson);
  const exportPdf    = useStore((s) => s.exportPdf);
  const pattern      = useStore((s) => s.pattern);
  const activeProject = useStore((s) => s.activeProject);
  const doneStitches = useStore((s) => s.doneStitches);
  const total        = useStore(totalStitches);
  useStore((s) => s.doneVersion); // re-render on progress change

  const [stitchRate, setStitchRate]   = useState(150);
  const [shareUrl, setShareUrl]       = useState<string | null>(null);
  const [shareState, setShareState]   = useState<'idle'|'loading'|'done'|'error'>('idle');
  const hasSupabase = Boolean(supabase);

  async function doCreateShareLink() {
    setShareState('loading');
    setShareUrl(null);
    const id = await createShareLink({
      name: activeProject?.name ?? 'pattern',
      width: pattern.width,
      height: pattern.height,
      matrix: Array.from(pattern.matrix),
      activeDmcIndices: pattern.activeDmcIndices ?? null,
    });
    if (id) {
      const url = `${window.location.origin}/?share=${id}`;
      setShareUrl(url);
      setShareState('done');
      navigator.clipboard?.writeText(url).catch(() => {});
    } else {
      setShareState('error');
    }
  }

  let doneCount = 0;
  for (let i = 0; i < doneStitches.length; i++) doneCount += doneStitches[i];
  const remaining = total - doneCount;
  const hoursLeft = stitchRate > 0 ? remaining / stitchRate : 0;
  const days = Math.floor(hoursLeft / 24);
  const hours = Math.floor(hoursLeft % 24);
  const pct = total > 0 ? ((doneCount / total) * 100).toFixed(1) : '0.0';

  function fmtTime(h: number): string {
    if (h <= 0) return 'Complete!';
    const d = Math.floor(h / 24);
    const hr = Math.floor(h % 24);
    if (d > 0) return `~${d}d ${hr}h`;
    return `~${hr}h`;
  }

  const [pngCell, setPngCell]     = useState(4);
  const [pdfCell, setPdfCell]     = useState(12);
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

  async function doExportPdf() {
    setExporting('pdf');
    // Yield to let UI update before heavy work
    await new Promise((r) => setTimeout(r, 60));
    try {
      await exportPdf(pdfCell, showDone);
    } finally {
      setExporting(null);
    }
  }

  const pdfPageEst = (() => {
    const MM_PER_PX = 0.264583;
    const cellMm = pdfCell * MM_PER_PX;
    const usableW = 297 - 20;
    const usableH = 210 - 20 - 14;
    const cPerPage = Math.floor(usableW / cellMm);
    const rPerPage = Math.floor(usableH / cellMm);
    const h = Math.ceil(pattern.width / cPerPage);
    const v = Math.ceil(pattern.height / rPerPage);
    return h * v + 1; // +1 for legend
  })();

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

          {/* ── Estimated Time ─────────────────────────────── */}
          <section className="export-section">
            <h3 className="export-section-title">Estimated Time Remaining</h3>

            <div className="grid grid-cols-3 gap-2 mt-2 text-center">
              <div className="bg-gray-50 rounded p-2">
                <div className="text-lg font-bold text-teal-600">{doneCount.toLocaleString()}</div>
                <div className="text-xs text-gray-500">Done</div>
              </div>
              <div className="bg-gray-50 rounded p-2">
                <div className="text-lg font-bold text-gray-700">{remaining.toLocaleString()}</div>
                <div className="text-xs text-gray-500">Remaining</div>
              </div>
              <div className="bg-gray-50 rounded p-2">
                <div className="text-lg font-bold text-gray-700">{pct}%</div>
                <div className="text-xs text-gray-500">Complete</div>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-3">
              <label className="text-sm text-gray-600 flex-shrink-0">My pace</label>
              <input
                type="range" min={10} max={500} step={10}
                value={stitchRate}
                onChange={(e) => setStitchRate(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm font-mono w-16 text-right">{stitchRate}/hr</span>
            </div>

            <div className="mt-3 bg-teal-50 border border-teal-200 rounded p-3 text-center">
              <div className="text-2xl font-bold text-teal-700">{fmtTime(hoursLeft)}</div>
              <div className="text-xs text-gray-500 mt-1">
                {remaining.toLocaleString()} stitches ÷ {stitchRate}/hr
                {hoursLeft > 24 && ` = ${days}d ${hours}h`}
              </div>
            </div>
          </section>

          <hr className="border-gray-200" />

          {/* ── PDF Export ────────────────── */}
          <section className="export-section">
            <h3 className="export-section-title">Export as PDF</h3>
            <p className="export-section-desc">
              Printable pattern chart — each stitch is one cell with its symbol,
              plus a color legend. A4 landscape, multiple pages for large patterns.
            </p>

            <div className="flex items-center gap-3 mt-3">
              <label className="text-sm text-gray-600 flex-shrink-0">Cell size</label>
              <input
                type="range" min={8} max={20} step={2}
                value={pdfCell}
                onChange={(e) => setPdfCell(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm font-mono w-8 text-center">{pdfCell}px</span>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <input
                id="pdf-show-done"
                type="checkbox"
                checked={showDone}
                onChange={(e) => setShowDone(e.target.checked)}
              />
              <label htmlFor="pdf-show-done" className="text-sm text-gray-600 cursor-pointer">
                Mark completed stitches
              </label>
            </div>

            <p className="text-xs text-gray-400 mt-1">
              Est. {pdfPageEst} page{pdfPageEst !== 1 ? 's' : ''} &nbsp;· {pattern.width}×{pattern.height} stitches
            </p>

            <button
              className="btn-primary mt-3 w-full"
              onClick={doExportPdf}
              disabled={!!exporting}
            >
              {exporting === 'pdf' ? 'Generating PDF…' : 'Download PDF'}
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

          <hr className="border-gray-200" />

          {/* ── Share Link ────────────────────────────────── */}
          <section className="export-section">
            <h3 className="export-section-title">Share Pattern</h3>
            <p className="export-section-desc">
              Generate a read-only link anyone can open to view your pattern
              (without progress). Requires internet.
            </p>
            {!hasSupabase && (
              <p className="text-xs text-amber-600 mt-2">
                Cloud not configured — share links unavailable offline.
              </p>
            )}
            {hasSupabase && (
              <button
                className="btn-primary mt-3 w-full"
                onClick={doCreateShareLink}
                disabled={shareState === 'loading'}
              >
                {shareState === 'loading' ? 'Creating link…' : 'Create share link'}
              </button>
            )}
            {shareState === 'done' && shareUrl && (
              <div className="mt-3">
                <p className="text-xs text-green-600 mb-1">Link copied to clipboard!</p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={shareUrl}
                    className="flex-1 text-xs border rounded px-2 py-1 bg-gray-50 font-mono"
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    className="btn-secondary text-xs px-3"
                    onClick={() => navigator.clipboard?.writeText(shareUrl)}
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
            {shareState === 'error' && (
              <p className="text-xs text-red-500 mt-2">Failed to create link. Check your connection.</p>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}
