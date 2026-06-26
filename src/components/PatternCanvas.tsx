import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { CanvasRenderer } from '../lib/canvasRenderer';

function WelcomeScreen() {
  const openSubview = useStore((s) => s.openSubview);
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-5 p-8 text-center">
      <div style={{ fontSize: '3rem' }}>🧵</div>
      <h2 className="text-xl font-semibold text-gray-700">No pattern open</h2>
      <p className="text-sm text-gray-500 max-w-xs">
        Create a new pattern, open a saved one, or import an .em file to get started.
      </p>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <button
          className="btn-primary"
          onClick={() => openSubview('new-pattern')}
        >
          New pattern
        </button>
        <button
          className="btn-secondary"
          onClick={() => openSubview('open-pattern')}
        >
          Open saved
        </button>
        <button
          className="btn-secondary"
          onClick={() => openSubview('import-pattern')}
        >
          Import .em file
        </button>
      </div>
    </div>
  );
}

export default function PatternCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rulerTopRef = useRef<HTMLDivElement>(null);
  const rulerLeftRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hasProject = useStore((s) => Boolean(s.activeProject.id));

  useEffect(() => {
    if (
      !hasProject ||
      !canvasRef.current ||
      !scrollRef.current ||
      !rulerTopRef.current ||
      !rulerLeftRef.current ||
      !wrapRef.current
    ) {
      return;
    }
    const renderer = new CanvasRenderer(
      {
        canvas: canvasRef.current,
        scrollEl: scrollRef.current,
        rulerTop: rulerTopRef.current,
        rulerLeft: rulerLeftRef.current,
        wrap: wrapRef.current,
      },
      useStore
    );
    const unsub = useStore.subscribe(() => renderer.syncFromStore());
    requestAnimationFrame(() => renderer.updateRulers());
    return () => {
      unsub();
      renderer.destroy();
    };
  }, [hasProject]);

  if (!hasProject) return <WelcomeScreen />;

  return (
    <div className="workspace flex-1">
      <div className="flex flex-col flex-1 min-w-0 h-full">
        <div className="flex flex-shrink-0">
          <div className="ruler-corner" />
          <div ref={rulerTopRef} className="ruler-top flex-1" />
        </div>
        <div className="flex flex-1 min-h-0">
          <div ref={rulerLeftRef} className="ruler-left" />
          <div ref={scrollRef} className="canvas-scroll">
            <div ref={wrapRef} className="canvas-wrap">
              <canvas ref={canvasRef} className="stitch-canvas" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
