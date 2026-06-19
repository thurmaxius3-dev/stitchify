import { useEffect, useRef } from 'react';
import { useStore, DMC_LIBRARY, visibleProjects } from '../../store';
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

function TrashIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

export default function OpenPattern() {
  const projects = useStore(visibleProjects);
  const loadProject = useStore((s) => s.loadProject);
  const deleteProject = useStore((s) => s.deleteProject);

  return (
    <section className="subview">
      <SubviewHeader title="Open pattern" />
      <div className="flex-1 overflow-y-auto">
        {projects.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">
            No saved patterns here yet. Create one from the menu or import a file.
          </p>
        ) : (
          projects.map((p) => (
            <div key={p.id} className="project-row">
              <button type="button" className="project-row-main" onClick={() => loadProject(p.id)}>
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
              <button
                type="button"
                className="project-delete-btn"
                aria-label={`Delete ${p.name}`}
                onClick={() => deleteProject(p.id)}
              >
                <TrashIcon />
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
