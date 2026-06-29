import { useStore, totalStitches } from './store';
import Header from './components/Header';
import { EditToolbar, ViewToolbar } from './components/Toolbars';
import PatternCanvas from './components/PatternCanvas';
import LeftDrawer from './components/LeftDrawer';
import NewPattern from './components/subviews/NewPattern';
import OpenPattern from './components/subviews/OpenPattern';
import ImportPattern from './components/subviews/ImportPattern';
import ThreadsLibrary from './components/subviews/ThreadsLibrary';
import CalculatorView from './components/subviews/CalculatorView';
import SettingsView from './components/subviews/SettingsView';
import ExportView from './components/subviews/ExportView';
import { useEffect } from 'react';
import { fetchSharedPattern } from './lib/supabase';
import OnboardingTour from './components/OnboardingTour';
import UpgradeView from './components/subviews/UpgradeView';
import { StreakView } from './components/subviews/StreakView';
import { MilestoneToast } from './components/MilestoneToast';
import { JournalView } from './components/subviews/JournalView';
import { WrappedView } from './components/subviews/WrappedView';

function ProgressFooter() {
  const doneStitches = useStore((s) => s.doneStitches);
  useStore((s) => s.doneVersion); // re-render when progress changes
  const total = useStore(totalStitches);
  let done = 0;
  for (let i = 0; i < doneStitches.length; i++) done += doneStitches[i];
  const pct = total ? (done / total) * 100 : 0;
  return (
    <div className="flex-shrink-0 bg-white border-t border-gray-200 px-3 py-1.5 flex items-center gap-3 app-safe-bottom">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full bg-teal-500 transition-[width] duration-200" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-600 font-medium whitespace-nowrap">
        {done.toLocaleString()} / {total.toLocaleString()} ({pct.toFixed(1)}%)
      </span>
    </div>
  );
}

export default function App() {
  const activeTab = useStore((s) => s.activeTab);
  const activeSubview = useStore((s) => s.activeSubview);
  const applyPattern = useStore((s) => s.applyPattern);

  // Handle ?share=<id> URL param — load shared pattern as read-only view
  useEffect(() => {
    const shareId = new URLSearchParams(window.location.search).get('share');
    if (!shareId) return;
    fetchSharedPattern(shareId).then((data) => {
      if (!data) return;
      const pattern = {
        width: data.width,
        height: data.height,
        matrix: new Uint16Array(data.matrix),
        activeDmcIndices: data.active_dmc_indices ?? null,
        originX: 0,
        originY: 0,
      };
      applyPattern(pattern, { name: data.name, readOnly: true });
      // Clean URL without reload
      window.history.replaceState({}, '', window.location.pathname);
    });
  }, []);

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: "100dvh" }}>
      <Header />
      {activeTab === 'edit' && <EditToolbar />}
      {activeTab === 'view' && <ViewToolbar />}

      <div className="flex flex-1 overflow-hidden relative">
        <PatternCanvas />
      </div>

      <ProgressFooter />
      <LeftDrawer />
      <OnboardingTour />

      {activeSubview === 'new-pattern' && <NewPattern />}
      {activeSubview === 'open-pattern' && <OpenPattern />}
      {activeSubview === 'import-pattern' && <ImportPattern />}
      {activeSubview === 'threads-library' && <ThreadsLibrary />}
      {activeSubview === 'calculator' && <CalculatorView />}
      {activeSubview === 'settings' && <SettingsView />}
      {activeSubview === 'export-pattern' && <ExportView />}
      {activeSubview === 'upgrade-pro' && <UpgradeView />}
      {activeSubview === 'streak-goals' && <StreakView />}
      {activeSubview === 'wip-journal' && <JournalView />}
      {activeSubview === 'wrapped' && <WrappedView />}
      <MilestoneToast />
    </div>
  );
}
