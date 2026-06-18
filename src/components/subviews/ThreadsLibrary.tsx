import { useMemo, useState } from 'react';
import { DMC_LIBRARY } from '../../store';
import SubviewHeader from './SubviewHeader';

function luminance(hex: string): number {
  return (
    parseInt(hex.slice(1, 3), 16) * 0.299 +
    parseInt(hex.slice(3, 5), 16) * 0.587 +
    parseInt(hex.slice(5, 7), 16) * 0.114
  );
}

export default function ThreadsLibrary() {
  const [query, setQuery] = useState('');
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DMC_LIBRARY;
    return DMC_LIBRARY.filter(
      (c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <section className="subview">
      <SubviewHeader title="DMC threads" />
      <div className="p-2 border-b border-gray-200">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by DMC number or name"
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
      </div>
      <div className="dmc-grid flex-1 overflow-y-auto">
        {list.map((c) => (
          <div key={c.id} className="dmc-swatch" style={{ background: c.hex }} title={c.name}>
            <span className={luminance(c.hex) > 160 ? 'text-black' : 'text-white'}>
              <strong>{c.code}</strong>
              <br />
              {c.name}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
