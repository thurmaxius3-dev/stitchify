import { useEffect, useRef } from 'react';
import { useStore, DMC_LIBRARY, MOCK_PROJECTS } from '../../store';
import { PatternEngine } from '../../lib/patternEngine';
import type { MockProject } from '../../lib/types';
import SubviewHeader from './SubviewHeader';

function Thumbnail({ project }: { project: MockProject }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = 64;
    const thumb = PatternEngine.generateProceduralPattern(
      size,
      Math.round(size * (project.height / project.width)),
      project.seed,
      DMC_LIBRARY
    );
    const scale = size / Math.max(thumb.width, thumb.height);
    for (let y = 0; y < thumb.height; y++) {
      for (let x = 0; x < thumb.width; x++) {
        ctx.fillStyle = DMC_LIBRARY[thumb.matrix[y * thumb.width + x]].hex;
        ctx.fillRect(x * scale, y * scale, Math.ceil(scale), Math.ceil(scale));
      }
    }
  }, [project]);
  return <canvas ref={ref} width={64} height={64} />;
}

export default function OpenPattern() {
  const loadProject = useStore((s) => s.loadProject);

  return (
    <section className="subview">
      <SubviewHeader title="Open pattern" />
      <div className="flex-1 overflow-y-auto">
        {MOCK_PROJECTS.map((p) => (
          <button key={p.id} type="button" className="project-row" onClick={() => loadProject(p.id)}>
            <div className="project-thumb">
              <Thumbnail project={p} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-gray-800">{p.name}</div>
              <div className="text-sm text-gray-500">
                {p.width}&times;{p.height}, {p.colorSystem}, {p.colorCount} colors
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-sm font-medium text-gray-700">{(p.progress * 100).toFixed(2)}%</div>
              <div className="text-xs text-gray-500">
                {p.stitched.toLocaleString()} / {p.total.toLocaleString()} st.
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
