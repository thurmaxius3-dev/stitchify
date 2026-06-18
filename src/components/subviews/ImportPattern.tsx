import { useRef, useState } from 'react';
import { useStore, DMC_LIBRARY } from '../../store';
import { StitchifyEmParser } from '../../lib/emParser';
import { ImportIcon } from '../icons';
import SubviewHeader from './SubviewHeader';

export default function ImportPattern() {
  const applyPattern = useStore((s) => s.applyPattern);
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ msg: string; error: boolean } | null>(null);

  const onFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.em')) {
      setStatus({ msg: 'Only eCanvas .em files are supported here.', error: true });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = StitchifyEmParser.parseEmFile(reader.result as ArrayBuffer, { dmcLibrary: DMC_LIBRARY });
        if (!parsed.pattern) {
          setStatus({ msg: 'Could not map pattern colors to the DMC library.', error: true });
          return;
        }
        const name = file.name.replace(/\.em$/i, '');
        const total = parsed.width * parsed.height;
        const stitched = parsed.doneCount || 0;
        applyPattern(parsed.pattern, { name, total, stitched, progress: total ? stitched / total : 0 });
      } catch (err) {
        setStatus({ msg: (err as Error).message || 'Failed to parse .em file.', error: true });
      }
    };
    reader.onerror = () => setStatus({ msg: 'Could not read file.', error: true });
    reader.readAsArrayBuffer(file);
  };

  return (
    <section className="subview">
      <SubviewHeader title="Import pattern" subtitle="Legacy eCanvas (.em)" />
      <div
        className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-500"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) onFile(f);
        }}
      >
        <ImportIcon className="w-16 h-16 mb-4 text-gray-400" />
        <p className="text-lg font-medium text-gray-700 mb-2">Import an eCanvas .em file</p>
        <p className="text-sm max-w-sm">
          Personal utility for opening legacy eCanvas saves. Drop a <code>.em</code> file here or browse. Completed
          stitches load automatically.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".em"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = '';
          }}
        />
        <button type="button" className="mt-6 calc-btn" onClick={() => fileRef.current?.click()}>
          Browse files
        </button>
        {status && (
          <p className={`text-xs mt-4 max-w-sm ${status.error ? 'text-red-600' : 'text-gray-500'}`}>{status.msg}</p>
        )}
      </div>
    </section>
  );
}
