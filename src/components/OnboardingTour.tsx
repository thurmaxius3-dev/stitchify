import { useState } from 'react';
import { useStore } from '../store';

const STEPS = [
  {
    title: 'Welcome to Stitchify',
    body: 'Your cross-stitch companion — create patterns, track your stitches, and keep all your projects in one place across every device.',
    emoji: '🧵',
    cta: 'Get started',
  },
  {
    title: 'Tap to mark stitches',
    body: 'Tap any cell on the canvas to mark it done. Drag to mark a run of stitches at once. Pinch to zoom in on the area you\'re working.',
    emoji: '✅',
    cta: 'Got it',
  },
  {
    title: 'Tools & sections',
    body: 'Use the pencil to paint colors, the marker to toggle done stitches, and the section tool to box off the area you\'re working on — then tap it from the side menu to jump straight back.',
    emoji: '🗂️',
    cta: 'Let\'s go',
  },
];

export default function OnboardingTour() {
  const hasSeenOnboarding = useStore((s) => s.hasSeenOnboarding);
  const dismissOnboarding  = useStore((s) => s.dismissOnboarding);
  const [step, setStep]    = useState(0);

  if (hasSeenOnboarding) return null;

  const current = STEPS[step];
  const isLast  = step === STEPS.length - 1;
  const progress = ((step + 1) / STEPS.length) * 100;

  function advance() {
    if (isLast) {
      dismissOnboarding();
    } else {
      setStep((s) => s + 1);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={(e) => { if (e.target === e.currentTarget) dismissOnboarding(); }}
    >
      {/* Card */}
      <div
        className="w-full max-w-md mx-auto mb-4 rounded-2xl bg-white shadow-2xl overflow-hidden"
        style={{ margin: '0 16px 32px', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-teal-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="p-6">
          {/* Emoji icon */}
          <div className="text-5xl text-center mb-4">{current.emoji}</div>

          {/* Title */}
          <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
            {current.title}
          </h2>

          {/* Body */}
          <p className="text-gray-600 text-center leading-relaxed mb-6" style={{ fontSize: '16px' }}>
            {current.body}
          </p>

          {/* Step dots */}
          <div className="flex justify-center gap-2 mb-6">
            {STEPS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setStep(i)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === step ? 'bg-teal-500' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            {!isLast && (
              <button
                type="button"
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-500 font-medium hover:bg-gray-50 transition-colors"
                style={{ fontSize: '16px' }}
                onClick={dismissOnboarding}
              >
                Skip
              </button>
            )}
            <button
              type="button"
              className="flex-1 py-3 rounded-xl bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-colors"
              style={{ fontSize: '16px' }}
              onClick={advance}
            >
              {current.cta}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
