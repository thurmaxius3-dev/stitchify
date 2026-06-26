/**
 * supabase.ts — Cloud sync layer for Stitchify.
 *
 * Handles auth (email/password + OAuth) and project CRUD against Supabase.
 * All functions are no-ops when the user is not signed in.
 */

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { SavedProject } from './db';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export let supabase: SupabaseClient | null = null;

try {
  if (
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    SUPABASE_URL.startsWith('http')
  ) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) {
  console.warn('Supabase init skipped (missing or invalid env vars):', e);
  supabase = null;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function getUser(): Promise<User | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function signUp(email: string, password: string) {
  if (!supabase) throw new Error('Supabase not configured');
  return supabase.auth.signUp({ email, password });
}

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error('Supabase not configured');
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signInWithGoogle() {
  if (!supabase) throw new Error('Supabase not configured');
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export function onAuthStateChange(callback: (user: User | null) => void) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => data.subscription.unsubscribe();
}

// ─── Cloud project CRUD ───────────────────────────────────────────────────────

export interface CloudProject {
  id: string;
  user_id: string;
  name: string;
  width: number;
  height: number;
  color_system: string;
  color_count: number;
  progress: number;
  stitched: number;
  total: number;
  matrix: number[];
  done_matrix: number[];
  active_dmc_indices: number[] | null;
  origin_x: number;
  origin_y: number;
  updated_at: string;
}

function toCloud(p: SavedProject, userId: string): CloudProject {
  return {
    id: p.id,
    user_id: userId,
    name: p.name,
    width: p.width,
    height: p.height,
    color_system: p.colorSystem,
    color_count: p.colorCount,
    progress: p.progress,
    stitched: p.stitched,
    total: p.total,
    matrix: p.matrix,
    done_matrix: p.doneMatrix,
    active_dmc_indices: p.activeDmcIndices,
    origin_x: p.originX,
    origin_y: p.originY,
    updated_at: new Date(p.updatedAt).toISOString(),
  };
}

export function fromCloud(c: CloudProject): SavedProject {
  return {
    id: c.id,
    name: c.name,
    width: c.width,
    height: c.height,
    colorSystem: c.color_system,
    colorCount: c.color_count,
    progress: c.progress,
    stitched: c.stitched,
    total: c.total,
    matrix: c.matrix,
    doneMatrix: c.done_matrix,
    activeDmcIndices: c.active_dmc_indices,
    originX: c.origin_x,
    originY: c.origin_y,
    updatedAt: new Date(c.updated_at).getTime(),
    syncedAt: Date.now(),
  };
}

export async function pushProjectToCloud(
  project: SavedProject,
  userId: string
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('projects')
    .upsert(toCloud(project, userId), { onConflict: 'id' });
  if (error) {
    console.error('[Stitchify] Cloud push failed:', error.message);
    return false;
  }
  return true;
}

export async function fetchCloudProjects(userId: string): Promise<SavedProject[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) {
    console.error('[Stitchify] Cloud fetch failed:', error.message);
    return [];
  }
  return (data as CloudProject[]).map(fromCloud);
}

export async function deleteCloudProject(id: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('projects').delete().eq('id', id);
}
