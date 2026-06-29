import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store';
import { computeWrappedStats } from '../../lib/wrappedStats';
import { renderWrappedCard } from '../../lib/wrappedRenderer';

type ShareState = 'idle' | 'sharing' | 'copied' | 'downloading';

export function WrappedView() {
  const closeSubview = useStore((s) => s.closeSubview);
  const storeState   = useStore((s) => s);          // snapshot for stats

  const [dataUrl, setDataUrl]     = useState<string | null>(null);
  const [shareState, setShareState] = useState<ShareState>('idle');
  const stats = useRef(computeWrappedStats(storeState));

  // Render card on mount (canvas ops are sync but we defer so the UI paints first)
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const url = renderWrappedCard(stats.current);
      setDataUrl(url);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── Share helpers ──────────────────────────────────────────────────────────

  async function handleShare() {
    if (!dataUrl) return;
    if (typeof navigator.share === 'function' && navigator.canShare) {
      try {
        setShareState('sharing');
        const res  = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], 'stitchify-wrapped.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'My Stitching Wrapped',
            text: `Check out my ${stats.current.year} stitching stats on Stitchify!`,
          });
          setShareState('idle');
          return;
        }
      } catch {
        // fall through to copy
      }
    }
    // Fallback: copy to clipboard
    try {
      const res  = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      setShareState('copied');
      setTimeout(() => setShareState('idle'), 2500);
    } catch {
      // Clipboard write not supported — fall through to download
      handleDownload();
    }
  }

  function handleDownload() {
    if (!dataUrl) return;
    setShareState('downloading');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `stitchify-wrapped-${stats.current.year}.png`;
    a.click();
    setTimeout(() => setShareState('idle'), 1500);
  }

  // ── Stats summary row ──────────────────────────────────────────────────────
  const s = stats.current;
  const statItems = [
    { value: s.totalStitchesDone.toLocaleString(), label: 'All-time stitches' },
    { value: `${s.bestStreak}d`,                   label: 'Best streak'        },
    { value: String(s.projectCount),               label: 'Projects'           },
  ];

  return (
    <div className="fixed inset-0 bg-white z-40 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Stitching Wrapped</h2>
          <p className="text-xs text-gray-400">{s.year} · your year in stitches</p>
        </div>
        <button
          onClick={closeSubview}
          className="text-gray-400 hover:text-gray-600 text-2xl leading-none px-1"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">

        {/* Quick stat bar */}
        <div className="flex justify-around px-4 py-4 border-b border-gray-50">
          {statItems.map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-0.5">
              <span className="text-xl font-bold text-gray-800">{item.value}</span>
              <span className="text-[11px] text-gray-400">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Card preview */}
        <div className="px-4 py-5">
          {dataUrl ? (
            <div className="rounded-2xl overflow-hidden shadow-xl border border-gray-100">
              <img
                src={dataUrl}
                alt="Your Stitching Wrapped card"
                className="w-full"
                style={{ aspectRatio: '1080/1920', objectFit: 'cover' }}
              />
            </div>
          ) : (
            <div
              className="rounded-2xl bg-gray-100 flex items-center justify-center"
              style={{ aspectRatio: '1080/1920' }}
            >
              <div className="flex flex-col items-center gap-3 text-gray-400">
                <div className="w-8 h-8 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
                <span className="text-sm">Generating your card…</span>
              </div>
            </div>
          )}
        </div>

        {/* Top colors */}
        {s.topColors.length > 0 && (
          <div className="px-4 pb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Most used colors
            </p>
            <div className="flex gap-2 flex-wrap">
              {s.topColors.map((c) => (
                <div key={c.code} className="flex items-center gap-1.5">
                  <span
                    className="w-5 h-5 rounded-md border border-gray-200 flex-shrink-0"
                    style={{ background: c.hex }}
                  />
                  <span className="text-xs text-gray-600">{c.code} {c.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Spacer for buttons */}
        <div className="h-4" />
      </div>

      {/* Action buttons */}
      <div
        className="px-4 py-3 border-t border-gray-100 flex-shrink-0 flex gap-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
      >
        <button
          onClick={handleShare}
          disabled={!dataUrl || shareState === 'sharing'}
          className="btn-primary flex-1 disabled:opacity-50"
        >
          {shareState === 'sharing'  ? 'Sharing…'
           : shareState === 'copied' ? '✓ Copied!'
           : '⬆ Share'}
        </button>
        <button
          onClick={handleDownload}
          disabled={!dataUrl || shareState === 'downloading'}
          className="btn-secondary px-5 disabled:opacity-50"
          title="Download PNG"
        >
          {shareState === 'downloading' ? '…' : '↓'}
        </button>
      </div>
    </div>
  );
}
