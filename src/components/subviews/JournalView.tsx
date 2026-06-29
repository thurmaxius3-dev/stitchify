import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store';
import type { JournalEntry } from '../../store';

const FREE_LIMIT = 3;

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

/** Compress an image file/blob to JPEG at reduced quality to keep IDB lean */
async function compressImage(source: Blob, maxDim = 1200, quality = 0.8): Promise<Blob> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(source);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
        else                { width = Math.round(width * maxDim / height); height = maxDim; }
      }
      const cvs = document.createElement('canvas');
      cvs.width = width; cvs.height = height;
      cvs.getContext('2d')!.drawImage(img, 0, 0, width, height);
      cvs.toBlob((b) => resolve(b ?? source), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(source); };
    img.src = url;
  });
}

// ─── Photo card ───────────────────────────────────────────────────────────────

function PhotoCard({ entry, onDelete }: { entry: JournalEntry; onDelete: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const u = URL.createObjectURL(entry.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [entry.blob]);

  return (
    <div className="rounded-xl overflow-hidden border border-gray-100 shadow-sm bg-white">
      {url ? (
        <img
          src={url}
          alt={entry.caption || 'WIP photo'}
          className="w-full object-cover"
          style={{ aspectRatio: '4/3' }}
        />
      ) : (
        <div className="w-full bg-gray-100 flex items-center justify-center" style={{ aspectRatio: '4/3' }}>
          <span className="text-gray-400 text-sm">Loading…</span>
        </div>
      )}
      <div className="px-3 py-2">
        {entry.caption && (
          <p className="text-sm text-gray-700 font-medium mb-1 line-clamp-2">{entry.caption}</p>
        )}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">{formatDate(entry.takenAt)}</p>
            {entry.progress > 0 && (
              <p className="text-xs text-indigo-500">{entry.progress}% complete</p>
            )}
          </div>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1"
              aria-label="Delete photo"
            >
              Delete
            </button>
          ) : (
            <div className="flex gap-1">
              <button
                onClick={onDelete}
                className="text-xs text-red-600 font-semibold px-2 py-1 rounded bg-red-50"
              >
                Yes, delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-gray-500 px-2 py-1"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add photo sheet ──────────────────────────────────────────────────────────

function AddPhotoSheet({ onClose }: { onClose: () => void }) {
  const addEntry      = useStore((s) => s.addJournalEntry);
  const openUpgrade   = useStore((s) => s.openUpgradeModal);
  const fileRef       = useRef<HTMLInputElement>(null);
  const [caption, setCaption]   = useState('');
  const [preview, setPreview]   = useState<string | null>(null);
  const [pendingBlob, setPending] = useState<Blob | null>(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    const compressed = await compressImage(file);
    setPending(compressed);
    const u = URL.createObjectURL(compressed);
    setPreview(u);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  async function handleSave() {
    if (!pendingBlob) { setError('Pick a photo first.'); return; }
    setSaving(true);
    const result = await addEntry(pendingBlob, caption.trim());
    setSaving(false);
    if (result === 'limit') {
      openUpgrade('Unlimited WIP photos');
      onClose();
    } else {
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center">
      <div
        className="bg-white w-full max-w-md rounded-t-2xl p-5 pb-safe flex flex-col gap-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800">Add WIP photo</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {/* Photo picker */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

        {preview ? (
          <div className="relative rounded-xl overflow-hidden border border-gray-200">
            <img src={preview} alt="Preview" className="w-full object-cover" style={{ aspectRatio: '4/3' }} />
            <button
              onClick={() => { setPreview(null); setPending(null); }}
              className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm"
            >
              ×
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 py-8 text-gray-400 hover:border-indigo-300 hover:text-indigo-400 transition-colors"
          >
            <span className="text-3xl">📷</span>
            <span className="text-sm">Tap to take or choose a photo</span>
          </button>
        )}

        {/* Caption */}
        <input
          type="text"
          placeholder="Add a caption (optional)"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={120}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving || !pendingBlob}
          className="btn-primary w-full disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save photo'}
        </button>
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function JournalView() {
  const isPro           = useStore((s) => s.isPro);
  const activeProject   = useStore((s) => s.activeProject);
  const journalEntries  = useStore((s) => s.journalEntries);
  const journalLoading  = useStore((s) => s.journalLoading);
  const loadJournal     = useStore((s) => s.loadJournal);
  const deleteEntry     = useStore((s) => s.deleteJournalEntryById);
  const openUpgrade     = useStore((s) => s.openUpgradeModal);
  const closeSubview    = useStore((s) => s.closeSubview);

  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    if (activeProject.id) loadJournal();
  }, [activeProject.id]);

  const count      = journalEntries.length;
  const atLimit    = !isPro && count >= FREE_LIMIT;

  function handleAddClick() {
    if (atLimit) {
      openUpgrade('Unlimited WIP photos');
    } else {
      setShowAdd(true);
    }
  }

  return (
    <div className="fixed inset-0 bg-white z-40 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <div>
          <h2 className="text-base font-semibold text-gray-800">WIP Journal</h2>
          {activeProject.name && (
            <p className="text-xs text-gray-400 truncate max-w-[200px]">{activeProject.name}</p>
          )}
        </div>
        <button
          onClick={closeSubview}
          className="text-gray-400 hover:text-gray-600 text-2xl leading-none px-1"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Free tier banner */}
      {!isPro && (
        <div
          className="mx-4 mt-3 rounded-xl px-4 py-2.5 flex items-center justify-between gap-2 flex-shrink-0"
          style={{ background: '#f5f3ff' }}
        >
          <div>
            <p className="text-xs font-semibold text-indigo-700">
              {count} / {FREE_LIMIT} photos used
            </p>
            <p className="text-xs text-indigo-500">Pro unlocks unlimited WIP photos</p>
          </div>
          <button
            onClick={() => openUpgrade('Unlimited WIP photos')}
            className="text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-full px-3 py-1 hover:bg-indigo-50 transition-colors whitespace-nowrap"
          >
            Go Pro
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {journalLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Loading…</div>
        ) : journalEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
            <span className="text-4xl">📷</span>
            <p className="text-sm font-medium text-gray-600">No photos yet</p>
            <p className="text-xs text-gray-400 max-w-xs">
              Document your progress — snap a photo after each stitching session to watch your piece come to life.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {journalEntries.map((entry) => (
              <PhotoCard
                key={entry.id}
                entry={entry}
                onDelete={() => deleteEntry(entry.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add button */}
      <div
        className="px-4 py-3 border-t border-gray-100 flex-shrink-0"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
      >
        <button
          onClick={handleAddClick}
          className={atLimit ? 'btn-secondary w-full' : 'btn-primary w-full'}
        >
          {atLimit ? '🔒 Upgrade for more photos' : '+ Add photo'}
        </button>
      </div>

      {showAdd && <AddPhotoSheet onClose={() => setShowAdd(false)} />}
    </div>
  );
}
