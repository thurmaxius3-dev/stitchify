import { useRef, useState } from 'react';
import { useStore, DMC_LIBRARY } from '../../store';
import { PatternEngine } from '../../lib/patternEngine';
import type { Pattern } from '../../lib/types';
import { ImageIcon } from '../icons';
import SubviewHeader from './SubviewHeader';

export default function NewPattern() {
  const applyPattern = useStore((s) => s.applyPattern);
  const fileRef = useRef<HTMLInputElement>(null);

  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [aspect, setAspect] = useState<number | null>(null);
  const [width, setWidth] = useState(100);
  const [height, setHeight] = useState(100);
  const [maxColors, setMaxColors] = useState(50);
  const [dithering, setDithering] = useState(false);
  const [converting, setConverting] = useState(false);
  const [status, setStatus] = useState<{ msg: string; error: boolean } | null>(null);

  const loadFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const src = ev.target?.result as string;
      try {
        const img = await PatternEngine.loadImage(src);
        const ratio = img.naturalWidth / img.naturalHeight;
        const dims = PatternEngine.stitchDimensionsFromWidth(width, ratio);
        setSourceImage(src);
        setAspect(ratio);
        setWidth(dims.width);
        setHeight(dims.height);
        setStatus(null);
      } catch {
        setStatus({ msg: 'Could not load image. Try a different file.', error: true });
      }
    };
    reader.readAsDataURL(file);
  };

  const onWidthChange = (raw: number) => {
    if (!raw) return;
    if (aspect == null) {
      setWidth(raw);
      return;
    }
    const dims = PatternEngine.stitchDimensionsFromWidth(raw, aspect);
    setWidth(dims.width);
    setHeight(dims.height);
  };

  const onHeightChange = (raw: number) => {
    if (!raw) return;
    if (aspect == null) {
      setHeight(raw);
      return;
    }
    const dims = PatternEngine.stitchDimensionsFromHeight(raw, aspect);
    setWidth(dims.width);
    setHeight(dims.height);
  };

  const convert = async () => {
    if (!sourceImage || converting) return;
    if (!width || !height || width < 10 || height < 10) {
      setStatus({ msg: 'Enter valid dimensions (10\u20132000 stitches).', error: true });
      return;
    }
    if (!maxColors || maxColors < 2 || maxColors > 100) {
      setStatus({ msg: 'Max colors must be between 2 and 100.', error: true });
      return;
    }
    setConverting(true);
    setStatus({
      msg: `Pass 1: extracting ${maxColors} colors\u2026 Pass 2: ${dithering ? 'Floyd\u2013Steinberg dither' : 'nearest snap'} (${width}\u00d7${height})`,
      error: false,
    });
    try {
      const pattern: Pattern = await PatternEngine.imageToPattern(sourceImage, width, height, DMC_LIBRARY, {
        maxColors,
        dithering,
      });
      applyPattern(pattern, { name: 'New Pattern', total: pattern.width * pattern.height, stitched: 0, progress: 0 });
    } catch {
      setStatus({ msg: 'Conversion failed. Try a different image.', error: true });
      setConverting(false);
    }
  };

  return (
    <section className="subview">
      <SubviewHeader
        title="New pattern"
        subtitle="Step 1: Source image"
        right={
          <button type="button" className="p-2 hover:bg-white/10 rounded" aria-label="Import image" onClick={() => fileRef.current?.click()}>
            <ImageIcon className="w-5 h-5" />
          </button>
        }
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) loadFile(f);
          e.target.value = '';
        }}
      />

      <div
        className="source-dropzone flex-1 min-h-0"
        onClick={() => !sourceImage && fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) loadFile(f);
        }}
      >
        {sourceImage ? <img src={sourceImage} alt="Source" /> : 'Tap to load a source photo'}
      </div>

      <div className="bg-white border-t flex-shrink-0">
        <div className="grid grid-cols-2 gap-0 border-b border-gray-200">
          <div className="calc-field !border-b-0">
            <label>Width (stitches)</label>
            <input type="number" min={10} max={2000} value={width} onChange={(e) => onWidthChange(parseInt(e.target.value, 10))} />
          </div>
          <div className="calc-field !border-b-0">
            <label>Height (stitches)</label>
            <input type="number" min={10} max={2000} value={height} onChange={(e) => onHeightChange(parseInt(e.target.value, 10))} />
          </div>
          {aspect != null && (
            <p className="text-xs text-teal-700 bg-teal-50 px-4 py-2 col-span-2 border-b border-gray-200">
              Aspect ratio locked to source image — editing width or height updates the other automatically.
            </p>
          )}
          <div className="calc-field !border-b-0 col-span-2">
            <label>Max colors</label>
            <input type="number" min={2} max={100} value={maxColors} onChange={(e) => setMaxColors(parseInt(e.target.value, 10) || 2)} />
          </div>
        </div>
        <label className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 accent-teal-500" checked={dithering} onChange={(e) => setDithering(e.target.checked)} />
          <span className="text-sm text-gray-800">Dithering</span>
        </label>
        {status && <p className={`text-xs px-4 py-2 ${status.error ? 'text-red-600' : 'text-gray-500'}`}>{status.msg}</p>}
        <div className="px-4 py-3 flex justify-end">
          <button
            type="button"
            disabled={!sourceImage || converting}
            onClick={convert}
            className={`font-bold uppercase tracking-wide ${
              !sourceImage || converting ? 'text-gray-400 cursor-not-allowed' : 'text-teal-600'
            }`}
          >
            {converting ? 'Converting\u2026' : 'Create'}
          </button>
        </div>
      </div>
    </section>
  );
}
