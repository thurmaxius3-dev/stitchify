import { useState } from 'react';
import { useStore } from '../../store';
import SubviewHeader from './SubviewHeader';

const PRO_FEATURES = [
  { icon: '🗂️', label: 'Section marking', desc: 'Box off regions and jump to them instantly' },
  { icon: '📄', label: 'PDF pattern export', desc: 'Printable chart with legend — A4 landscape' },
  { icon: '📁', label: 'Unlimited projects', desc: 'Free tier is limited to 3 saved projects' },
  { icon: '🔥', label: 'Stitch streaks & goals', desc: 'Daily targets and streak tracking (coming soon)' },
  { icon: '📸', label: 'WIP photo journal', desc: 'Photo timeline of your project progress (coming soon)' },
  { icon: '🤖', label: 'AI image-to-pattern', desc: 'Convert any photo to a DMC chart (coming soon)' },
  { icon: '☁️', label: 'Unlimited cloud sync', desc: 'All projects backed up to the cloud' },
];

const MONTHLY_PRICE = '$4.99';
const ANNUAL_PRICE  = '$39.99';
const ANNUAL_MONTHLY = '$3.33';

export default function UpgradeView() {
  const openSubview       = useStore((s) => s.openSubview);
  const proFeatureContext = useStore((s) => s.proFeatureContext);
  const activateProPreview = useStore((s) => s.activateProPreview);

  const [plan, setPlan]         = useState<'annual' | 'monthly'>('annual');
  const [email, setEmail]       = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleWaitlist(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    // Store waitlist email in Supabase (best-effort — no blocking if it fails)
    try {
      const { supabase } = await import('../../lib/supabase');
      if (supabase) {
        await supabase.from('pro_waitlist').insert({
          email: email.trim().toLowerCase(),
          plan,
          feature_context: proFeatureContext,
          created_at: new Date().toISOString(),
        });
      }
    } catch {
      // silent — don't block the success state on a DB error
    }
    // Also store locally so we don't prompt again
    localStorage.setItem('stitchify_waitlist_email', email.trim().toLowerCase());
    setSubmitted(true);
    setSubmitting(false);
  }

  const savedEmail = localStorage.getItem('stitchify_waitlist_email');

  return (
    <div className="subview-overlay">
      <div className="subview-panel" style={{ maxWidth: 480 }}>
        <SubviewHeader title="Stitchify Pro" />

        <div className="subview-body flex flex-col gap-0 overflow-y-auto">

          {/* Hero */}
          <div className="bg-gradient-to-b from-teal-700 to-teal-900 text-white px-6 pt-6 pb-8 text-center">
            <div className="text-4xl mb-2">✕</div>
            <h2 className="text-2xl font-bold mb-1">Stitchify Pro</h2>
            {proFeatureContext && (
              <p className="text-teal-200 text-sm mb-3">
                Unlock <strong className="text-white">{proFeatureContext}</strong> and everything below
              </p>
            )}

            {/* Plan toggle */}
            <div className="inline-flex bg-teal-800/60 rounded-xl p-1 mt-2 mb-4">
              <button
                type="button"
                onClick={() => setPlan('annual')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  plan === 'annual'
                    ? 'bg-white text-teal-800 shadow'
                    : 'text-teal-200 hover:text-white'
                }`}
              >
                Annual
                <span className="ml-1.5 text-xs bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded font-bold">
                  SAVE 33%
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPlan('monthly')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  plan === 'monthly'
                    ? 'bg-white text-teal-800 shadow'
                    : 'text-teal-200 hover:text-white'
                }`}
              >
                Monthly
              </button>
            </div>

            {/* Price display */}
            <div className="mt-1">
              {plan === 'annual' ? (
                <>
                  <span className="text-4xl font-bold">{ANNUAL_MONTHLY}</span>
                  <span className="text-teal-300 text-sm"> /month</span>
                  <div className="text-teal-300 text-xs mt-1">
                    Billed as {ANNUAL_PRICE}/year · 7-day free trial
                  </div>
                </>
              ) : (
                <>
                  <span className="text-4xl font-bold">{MONTHLY_PRICE}</span>
                  <span className="text-teal-300 text-sm"> /month</span>
                  <div className="text-teal-300 text-xs mt-1">7-day free trial · cancel anytime</div>
                </>
              )}
            </div>
          </div>

          {/* Feature list */}
          <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Everything in Pro
            </p>
            <div className="flex flex-col gap-2.5">
              {PRO_FEATURES.map((f) => (
                <div key={f.label} className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0 mt-0.5">{f.icon}</span>
                  <div>
                    <div className="text-sm font-semibold text-gray-800">{f.label}</div>
                    <div className="text-xs text-gray-500">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA — waitlist or already signed up */}
          <div className="px-5 py-5">
            {submitted || savedEmail ? (
              <div className="text-center">
                <div className="text-3xl mb-2">🎉</div>
                <p className="font-semibold text-gray-800 text-sm">You're on the list!</p>
                <p className="text-xs text-gray-500 mt-1 mb-4">
                  We'll email {submitted ? email : savedEmail} the moment Pro payments go live.
                  You'll get a launch discount for signing up early.
                </p>
                <button
                  type="button"
                  className="w-full py-3 rounded-xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 transition-colors"
                  onClick={() => openSubview(null)}
                >
                  Back to stitching
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-3 text-center">
                  Payments launching soon. Join the waitlist for{' '}
                  <strong>early access + a launch discount</strong>.
                </p>
                <form onSubmit={handleWaitlist} className="flex flex-col gap-3">
                  <input
                    type="email"
                    required
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    style={{ fontSize: 16 }}
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 rounded-xl bg-teal-600 text-white font-bold text-sm hover:bg-teal-700 transition-colors disabled:opacity-60"
                  >
                    {submitting ? 'Joining…' : `Join waitlist — ${plan === 'annual' ? ANNUAL_PRICE + '/yr' : MONTHLY_PRICE + '/mo'}`}
                  </button>
                </form>
                <p className="text-center text-xs text-gray-400 mt-2">
                  No credit card needed. Cancel anytime.
                </p>
              </>
            )}

            {/* Dev helper — hidden in production behind a flag */}
            {import.meta.env.DEV && (
              <button
                type="button"
                className="w-full mt-3 py-2 rounded-lg border border-dashed border-gray-300 text-xs text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors"
                onClick={activateProPreview}
              >
                [DEV] Activate Pro preview
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
