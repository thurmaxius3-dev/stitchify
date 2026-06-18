import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { CanvasRenderer } from '../lib/canvasRenderer';

export default function PatternCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rulerTopRef = useRef<HTMLDivElement>(null);
  const rulerLeftRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
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
  }, []);

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
