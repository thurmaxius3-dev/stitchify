/**
 * projectLock.ts — Device-level presence lock for open projects.
 *
 * When a project is opened, this device claims a lock in Supabase.
 * Other devices see the lock and switch to read-only mode.
 * The lock auto-expires after LOCK_TTL_S seconds if not renewed.
 * While the project is open, the lock is renewed every RENEW_INTERVAL_MS.
 */

import { supabase } from './supabase';

export const LOCK_TTL_S       = 60;   // seconds before lock expires
export const RENEW_INTERVAL_MS = 25_000; // renew every 25s (well before 60s expiry)

export interface ProjectLock {
  projectId:  string;
  userId:     string;
  deviceId:   string;
  lockedAt:   string;   // ISO
  expiresAt:  string;   // ISO
}

/** Stable per-browser-session device identifier */
export function getDeviceId(): string {
  let id = sessionStorage.getItem('stitchify_device_id');
  if (!id) {
    id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem('stitchify_device_id', id);
  }
  return id;
}

/**
 * Try to claim the lock for projectId.
 * Returns 'claimed'  — this device now holds the lock
 *         'taken'    — another device holds a valid (non-expired) lock
 *         'error'    — Supabase unavailable (fail open = allow editing)
 */
export async function claimLock(
  projectId: string,
  userId: string
): Promise<'claimed' | 'taken' | 'error'> {
  if (!supabase) return 'error';
  const deviceId = getDeviceId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCK_TTL_S * 1000).toISOString();

  // Check for an existing non-expired lock from a DIFFERENT device
  const { data: existing, error: fetchErr } = await supabase
    .from('project_locks')
    .select('device_id, expires_at, user_id')
    .eq('project_id', projectId)
    .single();

  if (fetchErr && fetchErr.code !== 'PGRST116') {
    // PGRST116 = no rows found — that's fine
    console.error('[Lock] fetch error', fetchErr.message);
    return 'error';
  }

  if (existing) {
    const expired = new Date(existing.expires_at) < now;
    const sameDevice = existing.device_id === deviceId;
    const sameUser   = existing.user_id === userId;

    if (!expired && !sameDevice && !sameUser) {
      // Another user's device holds a valid lock
      return 'taken';
    }
    // Same device, same user, or expired — we can take it over
  }

  // Upsert our lock
  const { error: upsertErr } = await supabase
    .from('project_locks')
    .upsert({
      project_id: projectId,
      user_id:    userId,
      device_id:  deviceId,
      locked_at:  now.toISOString(),
      expires_at: expiresAt,
    }, { onConflict: 'project_id' });

  if (upsertErr) {
    console.error('[Lock] upsert error', upsertErr.message);
    return 'error';
  }

  return 'claimed';
}

/** Renew the lock TTL. Call on a timer while the project is open. */
export async function renewLock(projectId: string, userId: string): Promise<void> {
  if (!supabase) return;
  const deviceId  = getDeviceId();
  const expiresAt = new Date(Date.now() + LOCK_TTL_S * 1000).toISOString();

  await supabase
    .from('project_locks')
    .update({ expires_at: expiresAt })
    .eq('project_id', projectId)
    .eq('device_id',  deviceId)
    .eq('user_id',    userId);
}

/** Release the lock (project closed, tab hidden, sign-out). */
export async function releaseLock(projectId: string, userId: string): Promise<void> {
  if (!supabase) return;
  const deviceId = getDeviceId();
  await supabase
    .from('project_locks')
    .delete()
    .eq('project_id', projectId)
    .eq('device_id',  deviceId)
    .eq('user_id',    userId);
}

/** Fetch the current lock holder for a project (for the read-only banner). */
export async function fetchLock(projectId: string): Promise<ProjectLock | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('project_locks')
    .select('*')
    .eq('project_id', projectId)
    .single();

  if (error || !data) return null;

  // Treat expired locks as absent
  if (new Date(data.expires_at) < new Date()) return null;

  return {
    projectId: data.project_id,
    userId:    data.user_id,
    deviceId:  data.device_id,
    lockedAt:  data.locked_at,
    expiresAt: data.expires_at,
  };
}

/** Force-take the lock regardless of who holds it. */
export async function takeOverLock(
  projectId: string,
  userId: string
): Promise<boolean> {
  if (!supabase) return false;
  const deviceId  = getDeviceId();
  const expiresAt = new Date(Date.now() + LOCK_TTL_S * 1000).toISOString();

  const { error } = await supabase
    .from('project_locks')
    .upsert({
      project_id: projectId,
      user_id:    userId,
      device_id:  deviceId,
      locked_at:  new Date().toISOString(),
      expires_at: expiresAt,
    }, { onConflict: 'project_id' });

  return !error;
}
