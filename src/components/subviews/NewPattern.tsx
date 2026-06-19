import { useRef, useState } from 'react';
import { useStore, DMC_LIBRARY } from '../../store';
import { PatternEngine } from '../../lib/patternEngine';
import type { Pattern } from '../../lib/types';
import { ImageIcon } from '../icons';
import SubviewHeader from './SubviewHeader';

const STITCH_MIN = 10;
const STITCH_MAX = 2000;

function parseStitchInput(value: string): number | null {
  const raw = value.trim();
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

function commitDimensions(
  widthText: string,
  heightText: string,
  aspect: number | null,
  driver: 'width' | 'height'
): { widthText: string; heightText: string } {
  const parsedW = parseStitchInput(widthText);
  const parsedH = parseStitchInput(heightText);

  if (aspect != null) {
    const seed = driver === 'width' ? parsedW : parsedH;
    if (seed == null || seed <= 0) {
      return { widthText, heightText };
    }
    const dims =
      driver === 'width'
        ? PatternEngine.stitchDimensionsFromWidth(seed, aspect)
        : PatternEngine.stitchDimensionsFromHeight(seed, aspect);
    return { widthText: String(dims.width), heightText: String(dims.height) };
  }

  const width = Math.max(STITCH_MIN, Math.min(STITCH_MAX, parsedW ?? STITCH_MIN));
  const height = Math.max(STITCH_MIN, Math.min(STITCH_MAX, parsedH ?? STITCH_MIN));
  return { widthText: String(width), heightText: String(height) };
}

export default function NewPattern() {
  const applyPattern = useStore((s) => s.applyPattern);
  const fileRef = useRef<HTMLInputElement>(null);

  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [aspect, setAspect] = useState<number | null>(null);
  const [widthText, setWidthText] = useState('100');
  const [heightText, setHeightText] = useState('100');
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
        const seed = parseStitchInput(widthText) ?? 100;
        const dims = PatternEngine.stitchDimensionsFromWidth(seed, ratio);
        setSourceImage(src);
        setAspect(ratio);
        setWidthText(String(dims.width));
        setHeightText(String(dims.height));
        setStatus(null);
      } catch {
        setStatus({ msg: 'Could not load image. Try a different file.', error: true });
      }
    };
    reader.readAsDataURL(file);
  };

  const onWidthInput = (value: string) => {
    setWidthText(value);
    const raw = parseStitchInput(value);
    if (raw == null || raw <= 0 || aspect == null) return;
    setHeightText(String(Math.round(raw / aspect)));
  };

  const onHeightInput = (value: string) => {
    setHeightText(value);
    const raw = parseStitchInput(value);
    if (raw == null || raw <= 0 || aspect == null) return;
    setWidthText(String(Math.round(raw * aspect)));
  };

  const onWidthBlur = () => {
    const next = commitDimensions(widthText, heightText, aspect, 'width');
    setWidthText(next.widthText);
    setHeightText(next.heightText);
  };

  const onHeightBlur = () => {
    const next = commitDimensions(widthText, heightText, aspect, 'height');
    setWidthText(next.widthText);
    setHeightText(next.heightText);
  };

  const convert = async () => {
    if (!sourceImage || converting) return;

    const committed = commitDimensions(widthText, heightText, aspect, 'width');
    setWidthText(committed.widthText);
    setHeightText(committed.heightText);

    const width = parseStitchInput(committed.widthText);
    const height = parseStitchInput(committed.heightText);

    if (width == null || height == null || width < STITCH_MIN || height < STITCH_MIN) {
      setStatus({ msg: `Enter valid dimensions (${STITCH_MIN}\u2013${STITCH_MAX} stitches).`, error: true });
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
            <input
              type="number"
              inputMode="numeric"
              value={widthText}
              onChange={(e) => onWidthInput(e.target.value)}
              onBlur={onWidthBlur}
            />
          </div>
          <div className="calc-field !border-b-0">
            <label>Height (stitches)</label>
            <input
              type="number"
              inputMode="numeric"
              value={heightText}
              onChange={(e) => onHeightInput(e.target.value)}
              onBlur={onHeightBlur}
            />
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
