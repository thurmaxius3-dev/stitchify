import { useEffect, useMemo, useRef } from 'react';
import { useStore, DMC_LIBRARY } from '../../store';
import { PatternEngine } from '../../lib/patternEngine';
import type { SavedProject } from '../../lib/db';
import SubviewHeader from './SubviewHeader';

function Thumbnail({ project }: { project: SavedProject }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = 64;
    // Reconstruct a small preview from the stored matrix
    const scaleX = size / project.width;
    const scaleY = size / project.height;
    const scale = Math.min(scaleX, scaleY);
    const matrix = new Uint16Array(project.matrix);
    for (let y = 0; y < project.height; y++) {
      for (let x = 0; x < project.width; x++) {
        ctx.fillStyle = DMC_LIBRARY[matrix[y * project.width + x]]?.hex ?? '#ccc';
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

function CloudIcon({ synced }: { synced: boolean }) {
  return (
    <svg
      className={`w-3 h-3 ml-1 ${synced ? 'text-teal-400' : 'text-gray-300'}`}
      fill="currentColor"
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z" />
    </svg>
  );
}

export default function OpenPattern() {
  const savedProjects = useStore((s) => s.savedProjects);
  const refreshSavedProjects = useStore((s) => s.refreshSavedProjects);
  const loadProject = useStore((s) => s.loadProject);
  const deleteProject = useStore((s) => s.deleteProject);
  const cloudSyncEnabled = useStore((s) => s.cloudSyncEnabled);

  useEffect(() => {
    refreshSavedProjects();
  }, [refreshSavedProjects]);

  const sorted = useMemo(
    () => [...savedProjects].sort((a, b) => b.updatedAt - a.updatedAt),
    [savedProjects]
  );

  function formatDate(ts: number) {
    return new Date(ts).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <section className="subview">
      <SubviewHeader title="Open pattern" />
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">
            No saved patterns yet. Create one from the menu or import a file.
          </p>
        ) : (
          sorted.map((p) => (
            <div key={p.id} className="project-row">
              <button type="button" className="project-row-main" onClick={() => loadProject(p.id)}>
                <div className="project-thumb">
                  <Thumbnail project={p} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-800 flex items-center">
                    {p.name}
                    {cloudSyncEnabled && <CloudIcon synced={p.syncedAt !== null} />}
                  </div>
                  <div className="text-sm text-gray-500">
                    {p.width}&times;{p.height}, {p.colorSystem}, {p.colorCount} colors
                  </div>
                  <div className="text-xs text-gray-400">{formatDate(p.updatedAt)}</div>
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
