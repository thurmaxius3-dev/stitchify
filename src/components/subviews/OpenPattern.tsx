import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useStore, DMC_LIBRARY } from '../../store';
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
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
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

/** Inline-editable project name row item */
function ProjectRow({ p, onLoad }: { p: SavedProject; onLoad: (id: string) => void }) {
  const deleteProject = useStore((s) => s.deleteProject);
  const duplicateProject = useStore((s) => s.duplicateProject);
  const renameProject = useStore((s) => s.renameProject);
  const cloudSyncEnabled = useStore((s) => s.cloudSyncEnabled);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(p.name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep draft in sync if name changes externally (e.g. cloud refresh)
  useEffect(() => {
    if (!editing) setDraft(p.name);
  }, [p.name, editing]);

  const startEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(p.name);
    setEditing(true);
    setTimeout(() => {
      inputRef.current?.select();
    }, 0);
  }, [p.name]);

  const commitEdit = useCallback(() => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== p.name) {
      renameProject(p.id, trimmed);
    } else {
      setDraft(p.name); // revert if blank or unchanged
    }
  }, [draft, p.id, p.name, renameProject]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') {
      setDraft(p.name);
      setEditing(false);
    }
  }, [commitEdit, p.name]);

  function formatDate(ts: number) {
    return new Date(ts).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="project-row">
      {/* Main clickable area — opens pattern */}
      <button
        type="button"
        className="project-row-main"
        onClick={() => !editing && onLoad(p.id)}
        style={{ cursor: editing ? 'default' : 'pointer' }}
      >
        <div className="project-thumb">
          <Thumbnail project={p} />
        </div>
        <div className="flex-1 min-w-0">
          {/* Name — double-click to rename */}
          <div className="font-semibold text-gray-800 flex items-center min-w-0">
            {editing ? (
              <input
                ref={inputRef}
                className="flex-1 min-w-0 border border-teal-400 rounded px-1 text-sm font-semibold text-gray-800 bg-white outline-none"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={onKeyDown}
                onClick={(e) => e.stopPropagation()}
                maxLength={80}
                aria-label="Rename project"
              />
            ) : (
              <span
                className="truncate cursor-text select-none"
                onDoubleClick={startEdit}
                title="Double-click to rename"
              >
                {p.name}
              </span>
            )}
            {cloudSyncEnabled && !editing && <CloudIcon synced={p.syncedAt !== null} />}
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

      {/* Action buttons */}
      <div className="flex flex-col gap-1 px-1">
        <button
          type="button"
          className="project-action-btn text-gray-400 hover:text-teal-600"
          aria-label={`Duplicate ${p.name}`}
          title="Duplicate"
          onClick={() => duplicateProject(p.id)}
        >
          <CopyIcon />
        </button>
        <button
          type="button"
          className="project-action-btn text-gray-400 hover:text-red-500"
          aria-label={`Delete ${p.name}`}
          title="Delete"
          onClick={() => deleteProject(p.id)}
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

export default function OpenPattern() {
  const savedProjects        = useStore((s) => s.savedProjects);
  const refreshSavedProjects = useStore((s) => s.refreshSavedProjects);
  const loadProject          = useStore((s) => s.loadProject);
  const cloudRestoring       = useStore((s) => s.cloudRestoring);
  const cloudUser            = useStore((s) => s.cloudUser);

  // Refresh from IDB on mount
  useEffect(() => {
    refreshSavedProjects();
  }, [refreshSavedProjects]);

  // Re-refresh whenever cloud restore finishes
  useEffect(() => {
    if (!cloudRestoring) {
      refreshSavedProjects();
    }
  }, [cloudRestoring]);

  const sorted = useMemo(
    () => [...savedProjects].sort((a, b) => b.updatedAt - a.updatedAt),
    [savedProjects]
  );

  return (
    <section className="subview">
      <SubviewHeader title="Open pattern" />

      {/* Cloud restore in-progress banner */}
      {cloudRestoring && (
        <div className="flex items-center gap-2 px-4 py-2 bg-teal-50 border-b border-teal-100 text-xs text-teal-700">
          <div className="w-3 h-3 border-2 border-teal-300 border-t-teal-600 rounded-full animate-spin flex-shrink-0" />
          Restoring your patterns from cloud…
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-500 mb-4">
              {cloudRestoring
                ? 'Fetching your patterns…'
                : 'No saved patterns yet. Create one from the menu or import a file.'}
            </p>
            {/* Manual refresh — safety net if auto-restore hasn\'t fired yet */}
            {cloudUser && !cloudRestoring && (
              <button
                onClick={refreshSavedProjects}
                className="text-xs text-teal-600 border border-teal-200 rounded-full px-3 py-1.5 hover:bg-teal-50"
              >
                Refresh from cloud
              </button>
            )}
          </div>
        ) : (
          sorted.map((p) => (
            <ProjectRow key={p.id} p={p} onLoad={loadProject} />
          ))
        )}
      </div>
    </section>
  );
}
