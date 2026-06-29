import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { CanvasRenderer } from '../lib/canvasRenderer';

function WelcomeScreen() {
  const openSubview    = useStore((s) => s.openSubview);
  const savedProjects  = useStore((s) => s.savedProjects);
  const loadProject    = useStore((s) => s.loadProject);

  // Most recently saved project
  const lastProject = savedProjects.length > 0 ? savedProjects[0] : null;

  function resumeLast() {
    if (!lastProject) return;
    loadProject(lastProject.id);
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-5 p-8 text-center">
      <div style={{ fontSize: '3rem' }}>🧵</div>
      <h2 className="text-xl font-semibold text-gray-700">
        {lastProject ? `Welcome back` : 'No pattern open'}
      </h2>
      <p className="text-sm text-gray-500 max-w-xs">
        {lastProject
          ? `Pick up where you left off, or start something new.`
          : 'Create a new pattern, open a saved one, or import an .em file to get started.'}
      </p>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        {lastProject && (
          <button
            className="btn-primary flex items-center justify-center gap-2"
            onClick={resumeLast}
          >
            <span>▶</span>
            <span>Resume &ldquo;{lastProject.name}&rdquo;</span>
          </button>
        )}
        <button
          className={lastProject ? 'btn-secondary' : 'btn-primary'}
          onClick={() => openSubview('new-pattern')}
        >
          New pattern
        </button>
        <button
          className="btn-secondary"
          onClick={() => openSubview('open-pattern')}
        >
          {lastProject ? 'All projects' : 'Open saved'}
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

const SECTION_COLORS = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#e91e63'];

export default function PatternCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rulerTopRef = useRef<HTMLDivElement>(null);
  const rulerLeftRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hasProject  = useStore((s) => Boolean(s.activeProject.id));
  const activeTool  = useStore((s) => s.activeTool);
  const cellSize    = useStore((s) => s.cellSize);
  const zoom        = useStore((s) => s.zoom);
  const sections    = useStore((s) => s.sections);
  const addSection  = useStore((s) => s.addSection);

  // Rubber-band state for section drawing
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const dragStart = useRef<{ cx: number; cy: number } | null>(null);

  const cell = cellSize * zoom;

  function clientToCell(clientX: number, clientY: number) {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return null;
    const rect = scrollEl.getBoundingClientRect();
    const col = Math.floor((clientX - rect.left + scrollEl.scrollLeft) / cell);
    const row = Math.floor((clientY - rect.top  + scrollEl.scrollTop)  / cell);
    return { col, row };
  }

  function onSectionPointerDown(e: React.PointerEvent) {
    if (activeTool !== 'section') return;
    const pos = clientToCell(e.clientX, e.clientY);
    if (!pos) return;
    dragStart.current = { cx: pos.col, cy: pos.row };
    setDrag({ x0: pos.col, y0: pos.row, x1: pos.col, y1: pos.row });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    e.stopPropagation();
  }

  function onSectionPointerMove(e: React.PointerEvent) {
    if (activeTool !== 'section' || !dragStart.current) return;
    const pos = clientToCell(e.clientX, e.clientY);
    if (!pos) return;
    setDrag({ x0: dragStart.current.cx, y0: dragStart.current.cy, x1: pos.col, y1: pos.row });
    e.stopPropagation();
  }

  function onSectionPointerUp(e: React.PointerEvent) {
    if (activeTool !== 'section' || !drag || !dragStart.current) return;
    const x = Math.min(drag.x0, drag.x1);
    const y = Math.min(drag.y0, drag.y1);
    const w = Math.abs(drag.x1 - drag.x0) + 1;
    const h = Math.abs(drag.y1 - drag.y0) + 1;
    dragStart.current = null;
    setDrag(null);
    if (w < 2 || h < 2) return; // too small, ignore
    const name = window.prompt('Section name:', `Section ${sections.length + 1}`);
    if (!name) return;
    const color = SECTION_COLORS[sections.length % SECTION_COLORS.length];
    addSection({ name: name.trim(), x, y, w, h, color });
    e.stopPropagation();
  }

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
          <div
            ref={scrollRef}
            className="canvas-scroll"
            onPointerDown={onSectionPointerDown}
            onPointerMove={onSectionPointerMove}
            onPointerUp={onSectionPointerUp}
          >
            {/* wrap provides virtual scroll dimensions; canvas overlays it sticky */}
            <div ref={wrapRef} className="canvas-wrap" />
            <canvas ref={canvasRef} className="stitch-canvas" />
            {/* Rubber-band overlay for section drawing */}
            {drag && activeTool === 'section' && (() => {
              const x = Math.min(drag.x0, drag.x1) * cell;
              const y = Math.min(drag.y0, drag.y1) * cell;
              const w = (Math.abs(drag.x1 - drag.x0) + 1) * cell;
              const h = (Math.abs(drag.y1 - drag.y0) + 1) * cell;
              const sl = scrollRef.current?.scrollLeft ?? 0;
              const st = scrollRef.current?.scrollTop  ?? 0;
              return (
                <div
                  className="section-rubber-band"
                  style={{
                    left: x - sl,
                    top:  y - st,
                    width: w,
                    height: h,
                    borderColor: SECTION_COLORS[sections.length % SECTION_COLORS.length],
                  }}
                />
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
