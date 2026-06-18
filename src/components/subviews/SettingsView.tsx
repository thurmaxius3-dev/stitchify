import { useState } from 'react';
import SubviewHeader from './SubviewHeader';

export default function SettingsView() {
  const [keepScreenOn, setKeepScreenOn] = useState(true);

  const toggleKeepScreen = (checked: boolean) => {
    setKeepScreenOn(checked);
    if (checked && 'wakeLock' in navigator) {
      // Best-effort; ignored if unsupported or denied.
      (navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<unknown> } }).wakeLock
        ?.request('screen')
        .catch(() => {});
    }
  };

  return (
    <section className="subview">
      <SubviewHeader title="Settings" />
      <div className="flex-1 overflow-y-auto">
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
