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

function ProgressFooter() {
  const doneStitches = useStore((s) => s.doneStitches);
  useStore((s) => s.doneVersion); // re-render when progress changes
  const total = useStore(totalStitches);
  let done = 0;
  for (let i = 0; i < doneStitches.length; i++) done += doneStitches[i];
  const pct = total ? (done / total) * 100 : 0;
  return (
    <div className="flex-shrink-0 bg-white border-t border-gray-200 px-3 py-1.5 flex items-center gap-3">
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

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header />
      {activeTab === 'edit' && <EditToolbar />}
      {activeTab === 'view' && <ViewToolbar />}

      <div className="flex flex-1 overflow-hidden relative">
        <PatternCanvas />
      </div>

      <ProgressFooter />
      <LeftDrawer />

      {activeSubview === 'new-pattern' && <NewPattern />}
      {activeSubview === 'open-pattern' && <OpenPattern />}
      {activeSubview === 'import-pattern' && <ImportPattern />}
      {activeSubview === 'threads-library' && <ThreadsLibrary />}
      {activeSubview === 'calculator' && <CalculatorView />}
      {activeSubview === 'settings' && <SettingsView />}
      {activeSubview === 'export-pattern' && <ExportView />}
    </div>
  );
}
