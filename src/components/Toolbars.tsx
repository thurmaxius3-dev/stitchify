import { useEffect, useState } from 'react';
import { useStore } from '../store';
import type { GridMode } from '../lib/types';
import {
  MarkerIcon,
  SectionIcon,
  EyedropperIcon,
  PencilIcon,
  WandIcon,
  BucketIcon,
  UndoIcon,
  RedoIcon,
  ContrastIcon,
} from './icons';

export function EditToolbar() {
  const activeTool = useStore((s) => s.activeTool);
  const setTool = useStore((s) => s.setTool);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const canUndo = useStore((s) => s.undoStack.length > 0);
  const canRedo = useStore((s) => s.redoStack.length > 0);
  const zoom = useStore((s) => s.zoom);
  const setZoom = useStore((s) => s.setZoom);

  const tools = [
    { id: 'pencil',     label: 'Pencil — paint cells with selected color',           Icon: PencilIcon },
    { id: 'bucket',     label: 'Fill bucket — flood fill connected region',           Icon: BucketIcon },
    { id: 'marker',     label: 'Marker — mark/unmark done stitches of selected color', Icon: MarkerIcon },
    { id: 'eyedropper', label: 'Eye dropper — pick color from cell',                  Icon: EyedropperIcon },
    { id: 'section',    label: 'Section — draw a named zone on the pattern',           Icon: SectionIcon },
    { id: 'wand',       label: 'Magic Wand',                                          Icon: WandIcon },
  ] as const;

  return (
    <div className="bg-toolbar-bg border-b border-gray-300 flex items-center gap-1 px-2 py-1 flex-shrink-0">
      {tools.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className={`tool-btn${activeTool === id ? ' active' : ''}`}
          title={label}
          onClick={() => setTool(id)}
        >
          <Icon className="w-5 h-5" />
        </button>
      ))}
      <div className="w-px h-6 bg-gray-400 mx-1" />
      <button type="button" className="tool-btn" title="Undo" disabled={!canUndo} onClick={undo}>
        <UndoIcon className="w-5 h-5" />
      </button>
      <button type="button" className="tool-btn" title="Redo" disabled={!canRedo} onClick={redo}>
        <RedoIcon className="w-5 h-5" />
      </button>
      <div className="ml-auto flex items-center gap-1">
        <button type="button" className="tool-btn text-xs font-bold" title="Zoom out" onClick={() => setZoom(zoom - 0.25)}>
          &minus;
        </button>
        <span className="text-xs text-gray-600 w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button type="button" className="tool-btn text-xs font-bold" title="Zoom in" onClick={() => setZoom(zoom + 0.25)}>
          +
        </button>
      </div>
    </div>
  );
}

const GRID_BUTTONS: { id: GridMode; title: string; svg: React.ReactNode }[] = [
  { id: 'none', title: 'No grid', svg: <span className="w-5 h-5 bg-gray-400 rounded-sm block" /> },
  {
    id: 'light',
    title: 'Light pixel grid',
    svg: (
      <svg className="w-5 h-5" viewBox="0 0 20 20">
        <path
          d="M0 0h20v1H0zm0 4h20v1H0zm0 4h20v1H0zm0 4h20v1H0zm0 4h20v1H0zM0 0h1v20H0zm4 0h1v20H4zm4 0h1v20H8zm4 0h1v20h-1zm4 0h1v20h-1z"
          fill="#333"
        />
      </svg>
    ),
  },
  {
    id: 'heavy',
    title: 'Heavy 10\u00d710 grid',
    svg: (
      <svg className="w-5 h-5" viewBox="0 0 20 20">
        <path d="M0 0h20v20H0z" fill="none" stroke="#333" strokeWidth="0.5" />
        <path d="M0 10h20M10 0v20" stroke="#000" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    id: 'red',
    title: 'High-contrast red grid',
    svg: (
      <svg className="w-5 h-5" viewBox="0 0 20 20">
        <path d="M0 0h20v20H0z" fill="none" stroke="#ccc" strokeWidth="0.3" />
        <path d="M0 10h20M10 0v20" stroke="#e53935" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    id: 'combined',
    title: 'Combined grid',
    svg: (
      <svg className="w-5 h-5" viewBox="0 0 20 20">
        <path d="M0 0h20v1H0zm0 4h20v1H0zm0 4h20v1H0zm0 4h20v1H0zm0 4h20v1H0zM0 10h20M10 0v20" stroke="#e53935" strokeWidth="1" />
        <path d="M0 0h1v20H0zm4 0h1v20H4z" fill="#333" />
      </svg>
    ),
  },
];

export function ViewToolbar() {
  const viewMode = useStore((s) => s.viewMode);
  const setViewMode = useStore((s) => s.setViewMode);
  const symbolStyle = useStore((s) => s.symbolStyle);
  const setSymbolStyle = useStore((s) => s.setSymbolStyle);
  const gridMode = useStore((s) => s.gridMode);
  const setGridMode = useStore((s) => s.setGridMode);
  const contrast = useStore((s) => s.contrast);
  const setContrast = useStore((s) => s.setContrast);
  const [contrastOpen, setContrastOpen] = useState(false);

  useEffect(() => {
    if (!contrastOpen) return;
    const close = () => setContrastOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [contrastOpen]);

  return (
    <div className="bg-toolbar-bg border-b border-gray-300 flex items-center gap-1 px-2 py-1 flex-shrink-0 flex-wrap">
      <div className="relative">
        <button
          type="button"
          className="tool-btn"
          title="Contrast"
          onClick={(e) => {
            e.stopPropagation();
            setContrastOpen((o) => !o);
          }}
        >
          <ContrastIcon className="w-5 h-5" />
        </button>
        {contrastOpen && (
          <div className="contrast-popover" onClick={(e) => e.stopPropagation()}>
            <label className="text-xs text-gray-600 block mb-1">Symbol contrast</label>
            <input
              type="range"
              min={0}
              max={100}
              value={contrast}
              onChange={(e) => setContrast(parseInt(e.target.value, 10))}
              className="w-full"
            />
          </div>
        )}
      </div>

      <button
        type="button"
        className={`tool-btn${viewMode === 'solid' ? ' active' : ''}`}
        title="Solid block view"
        onClick={() => setViewMode('solid')}
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeWidth={2} d="M12 2a10 10 0 100 20 10 10 0 000-20z" />
        </svg>
      </button>
      <button
        type="button"
        className={`tool-btn${symbolStyle === 'x' && viewMode === 'symbol-color' ? ' active' : ''}`}
        title="X symbols"
        onClick={() => setSymbolStyle('x')}
      >
        <span className="font-bold text-lg leading-none">&times;</span>
      </button>
      <button
        type="button"
        className={`tool-btn${symbolStyle === 'circle' && viewMode === 'symbol-color' ? ' active' : ''}`}
        title="Circle symbols"
        onClick={() => setSymbolStyle('circle')}
      >
        <span className="font-bold text-lg leading-none">&#9675;</span>
      </button>

      <div className="w-px h-6 bg-gray-400 mx-1" />

      {GRID_BUTTONS.map((g) => (
        <button
          key={g.id}
          type="button"
          className={`grid-btn${gridMode === g.id ? ' active' : ''}`}
          title={g.title}
          onClick={() => setGridMode(g.id)}
        >
          {g.svg}
        </button>
      ))}

      <div className="ml-auto flex gap-1">
        <button
          type="button"
          className={`tool-btn text-xs px-2${viewMode === 'symbol-color' ? ' active' : ''}`}
          title="Symbol & color"
          onClick={() => setViewMode('symbol-color')}
        >
          Sym+Color
        </button>
        <button
          type="button"
          className={`tool-btn text-xs px-2${viewMode === 'chart' ? ' active' : ''}`}
          title="Chart / print"
          onClick={() => setViewMode('chart')}
        >
          Chart
        </button>
      </div>
    </div>
  );
}
