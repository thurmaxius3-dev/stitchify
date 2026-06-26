import { useState } from 'react';
import { useStore } from '../../store';
import { signIn, signUp, signOut, signInWithGoogle } from '../../lib/supabase';
import SubviewHeader from './SubviewHeader';

type AuthMode = 'none' | 'signin' | 'signup';

export default function SettingsView() {
  const [keepScreenOn, setKeepScreenOn] = useState(true);
  const cloudUser = useStore((s) => s.cloudUser);
  const cloudSyncEnabled = useStore((s) => s.cloudSyncEnabled);
  const setCloudSync = useStore((s) => s.setCloudSync);

  const [authMode, setAuthMode] = useState<AuthMode>('none');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  const toggleKeepScreen = (checked: boolean) => {
    setKeepScreenOn(checked);
    if (checked && 'wakeLock' in navigator) {
      (navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<unknown> } }).wakeLock
        ?.request('screen')
        .catch(() => {});
    }
  };

  const handleAuth = async () => {
    setAuthError(null);
    setAuthSuccess(null);
    setAuthLoading(true);
    try {
      if (authMode === 'signin') {
        const { error } = await signIn(email, password);
        if (error) throw error;
        setAuthMode('none');
      } else if (authMode === 'signup') {
        const { error } = await signUp(email, password);
        if (error) throw error;
        setAuthSuccess('Check your email to confirm your account, then sign in.');
        setAuthMode('none');
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setCloudSync(false);
  };

  return (
    <section className="subview">
      <SubviewHeader title="Settings" />
      <div className="flex-1 overflow-y-auto">

        {/* ── Screen ── */}
        <h2 className="settings-section">Screen</h2>
        <div className="settings-row">
          <div>
            <div className="font-medium text-gray-800">Keep the screen on</div>
            <p>Do not turn off the screen while embroidering</p>
          </div>
          <input
            type="checkbox"
            checked={keepScreenOn}
            onChange={(e) => toggleKeepScreen(e.target.checked)}
            className="w-5 h-5 accent-teal-500 flex-shrink-0 mt-1"
          />
        </div>

        {/* ── Cloud sync ── */}
        <h2 className="settings-section">Cloud sync</h2>

        {cloudUser ? (
          <>
            <div className="settings-row">
              <div>
                <div className="font-medium text-gray-800">Signed in</div>
                <p className="text-xs break-all">{cloudUser.email}</p>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="text-sm text-red-500 font-medium flex-shrink-0"
              >
                Sign out
              </button>
            </div>
            <div className="settings-row">
              <div>
                <div className="font-medium text-gray-800">Auto-sync to cloud</div>
                <p>Back up patterns to your account automatically</p>
              </div>
              <input
                type="checkbox"
                checked={cloudSyncEnabled}
                onChange={(e) => setCloudSync(e.target.checked)}
                className="w-5 h-5 accent-teal-500 flex-shrink-0 mt-1"
              />
            </div>
          </>
        ) : (
          <>
            <div className="px-4 py-3 text-sm text-gray-500">
              Sign in to back up your patterns across devices.
            </div>

            {authMode === 'none' && (
              <div className="px-4 pb-4 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => { setAuthMode('signin'); setAuthError(null); setAuthSuccess(null); }}
                  className="w-full py-2 rounded-lg bg-teal-500 text-white font-semibold text-sm"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthMode('signup'); setAuthError(null); setAuthSuccess(null); }}
                  className="w-full py-2 rounded-lg border border-teal-500 text-teal-600 font-semibold text-sm"
                >
                  Create account
                </button>
                <button
                  type="button"
                  onClick={signInWithGoogle}
                  className="w-full py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold text-sm flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>
              </div>
            )}

            {(authMode === 'signin' || authMode === 'signup') && (
              <div className="px-4 pb-4 flex flex-col gap-3">
                <div className="text-sm font-medium text-gray-700">
                  {authMode === 'signin' ? 'Sign in to your account' : 'Create a new account'}
                </div>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                />
                {authError && <p className="text-xs text-red-500">{authError}</p>}
                {authSuccess && <p className="text-xs text-teal-600">{authSuccess}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAuth}
                    disabled={authLoading}
                    className="flex-1 py-2 rounded-lg bg-teal-500 text-white font-semibold text-sm disabled:opacity-50"
                  >
                    {authLoading ? 'Please wait…' : authMode === 'signin' ? 'Sign in' : 'Create account'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode('none')}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── About ── */}
        <h2 className="settings-section">About</h2>
        <div className="settings-row">
          <div>
            <div className="font-medium text-gray-800">Stitchify</div>
            <p>Cross-stitch pattern maker &amp; progress tracker. Installable as an app.</p>
          </div>
        </div>

      </div>
    </section>
  );
}
