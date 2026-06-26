/**
 * autoSave.ts — Debounced auto-save orchestrator.
 *
 * Call `scheduleAutoSave(snapshot)` whenever the project changes.
 * It debounces writes to IndexedDB (local) and optionally syncs to Supabase.
 */

import { saveProject, setLastOpenProjectId, type SavedProject } from './db';
import { pushProjectToCloud } from './supabase';

const DEBOUNCE_MS = 2000;

let _timer: ReturnType<typeof setTimeout> | null = null;
let _userId: string | null = null;
let _cloudEnabled = false;

/** Called by auth state changes in the store. */
export function setCloudUser(userId: string | null, enabled: boolean) {
  _userId = userId;
  _cloudEnabled = enabled;
}

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

type StatusListener = (s: SaveStatus) => void;
const _listeners = new Set<StatusListener>();

export function onSaveStatus(fn: StatusListener) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

function emit(status: SaveStatus) {
  _listeners.forEach((fn) => fn(status));
}

export function scheduleAutoSave(project: SavedProject) {
  if (_timer) clearTimeout(_timer);
  emit('pending');
  _timer = setTimeout(() => {
    _timer = null;
    doSave(project);
  }, DEBOUNCE_MS);
}

async function doSave(project: SavedProject) {
  emit('saving');
  try {
    await saveProject(project);
    await setLastOpenProjectId(project.id);

    if (_cloudEnabled && _userId) {
      await pushProjectToCloud(project, _userId);
    }

    emit('saved');
    // Reset to idle after 2 s so the indicator fades
    setTimeout(() => emit('idle'), 2000);
  } catch (err) {
    console.error('[Stitchify] Auto-save failed:', err);
    emit('error');
  }
}

/** Force an immediate save (e.g. on page hide). */
export function flushAutoSave(project: SavedProject) {
  if (_timer) {
    clearTimeout(_timer);
    _timer = null;
  }
  return doSave(project);
}
