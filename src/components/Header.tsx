import { useEffect, useState } from 'react';
import { useStore } from '../store';
import {
  MenuIcon,
  FullscreenIcon,
  InfoIcon,
  HomeIcon,
  PaletteIcon,
  EyeIcon,
  ShareIcon,
} from './icons';
import PaletteDropdown from './PaletteDropdown';
import { onSaveStatus, type SaveStatus } from '../lib/autoSave';

function SaveIndicator() {
  const [status, setStatus] = useState<SaveStatus>('idle');

  useEffect(() => {
    return onSaveStatus(setStatus);
  }, []);

  if (status === 'idle') return null;

  const label =
    status === 'pending' || status === 'saving'
      ? 'Saving…'
      : status === 'saved'
      ? 'Saved'
      : 'Save error';

  const color =
    status === 'error'
      ? 'text-red-300'
      : status === 'saved'
      ? 'text-teal-300'
      : 'text-white/60';

  return (
    <span className={`text-xs font-medium transition-opacity ${color}`} aria-live="polite">
      {label}
    </span>
  );
}

export default function Header() {
  const activeTab = useStore((s) => s.activeTab);
  const paletteOpen = useStore((s) => s.paletteDropdownOpen);
  const projectName = useStore((s) => s.activeProject.name);
  const setTab = useStore((s) => s.setTab);
  const togglePalette = useStore((s) => s.togglePaletteDropdown);
  const closePalette = useStore((s) => s.closePaletteDropdown);
  const set = useStore((s) => s.set);
  const pattern = useStore((s) => s.pattern);
  const paletteLen = useStore((s) => s.projectPalette.length);
  const openSubview = useStore((s) => s.openSubview);

  useEffect(() => {
    if (!paletteOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.palette-tab-wrap')) closePalette();
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [paletteOpen, closePalette]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  const showInfo = () => {
    alert(
      `Stitchify\nProject: ${projectName}\n` +
        `Pattern: ${pattern.width}\u00d7${pattern.height} stitches\n` +
        `Colors used: ${paletteLen}`
    );
  };

  return (
    <header className="bg-header text-white flex-shrink-0 z-30">
      <div className="flex items-center justify-between px-2 sm:px-3 h-10">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            className="p-2 hover:bg-white/10 rounded"
            aria-label="Menu"
            onClick={() => set({ leftDrawerOpen: true })}
          >
            <MenuIcon className="w-6 h-6" />
          </button>
          <span className="text-sm sm:text-base font-medium truncate">{projectName}</span>
          <SaveIndicator />
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className="p-2 hover:bg-white/10 rounded" aria-label="Fullscreen" onClick={toggleFullscreen}>
            <FullscreenIcon className="w-5 h-5" />
          </button>
          <button type="button" className="p-2 hover:bg-white/10 rounded" aria-label="Info" onClick={showInfo}>
            <InfoIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      <nav className="flex justify-center gap-1 pb-1 px-2">
        <button
          type="button"
          className={`header-tab${activeTab === 'edit' ? ' active' : ''}`}
          aria-label="Home / Edit"
          onClick={() => setTab('edit')}
        >
          <HomeIcon className="w-5 h-5" />
        </button>

        <div className="relative palette-tab-wrap">
          <button
            type="button"
            className={`header-tab${paletteOpen ? ' active' : ''}`}
            aria-label="Palette"
            aria-haspopup="true"
            aria-expanded={paletteOpen}
            onClick={(e) => {
              e.stopPropagation();
              togglePalette();
            }}
          >
            <PaletteIcon className="w-5 h-5" />
          </button>
          {paletteOpen && <PaletteDropdown />}
        </div>

        <button
          type="button"
          className={`header-tab${activeTab === 'view' ? ' active' : ''}`}
          aria-label="View"
          onClick={() => setTab('view')}
        >
          <EyeIcon className="w-5 h-5" />
        </button>

        <button
          type="button"
          className="header-tab"
          aria-label="Share"
          onClick={() => openSubview('export-pattern')}
        >
          <ShareIcon className="w-5 h-5" />
        </button>
      </nav>
    </header>
  );
}
