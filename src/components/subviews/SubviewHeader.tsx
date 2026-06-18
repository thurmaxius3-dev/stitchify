import type { ReactNode } from 'react';
import { useStore } from '../../store';
import { BackIcon } from '../icons';

export default function SubviewHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  const closeSubview = useStore((s) => s.closeSubview);
  return (
    <div className="subview-header">
      <button type="button" className="p-1 hover:bg-white/10 rounded" aria-label="Back" onClick={closeSubview}>
        <BackIcon className="w-6 h-6" />
      </button>
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-medium truncate">{title}</h1>
        {subtitle && <p className="text-xs text-white/80">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
