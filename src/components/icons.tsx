import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { className?: string };

const stroke = (props: IconProps, d: string, extra?: React.ReactNode) => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    {extra}
  </svg>
);

export const MenuIcon = (p: IconProps) => stroke(p, 'M4 6h16M4 12h16M4 18h16');

export const FullscreenIcon = (p: IconProps) =>
  stroke(p, 'M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5h-4m4 0v-4m0 4l-5-5');

export const InfoIcon = (p: IconProps) => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...p}>
    <circle cx="12" cy="12" r="10" strokeWidth={2} />
    <path strokeLinecap="round" strokeWidth={2} d="M12 16v-4M12 8h.01" />
  </svg>
);

export const HomeIcon = (p: IconProps) => (
  <svg fill="currentColor" viewBox="0 0 24 24" {...p}>
    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
  </svg>
);

export const PaletteIcon = (p: IconProps) => (
  <svg fill="currentColor" viewBox="0 0 24 24" {...p}>
    <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8z" />
    <circle cx="6.5" cy="11.5" r="1.5" />
    <circle cx="9.5" cy="7.5" r="1.5" />
    <circle cx="14.5" cy="7.5" r="1.5" />
    <circle cx="17.5" cy="11.5" r="1.5" />
  </svg>
);

export const EyeIcon = (p: IconProps) => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...p}>
    <path strokeLinecap="round" strokeWidth={2} d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" strokeWidth={2} />
  </svg>
);

export const ShareIcon = (p: IconProps) => (
  <svg fill="currentColor" viewBox="0 0 24 24" {...p}>
    <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" />
  </svg>
);

export const EraserIcon = (p: IconProps) => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...p}>
    <rect x="5" y="7" width="14" height="14" rx="1" strokeWidth={2} />
    <path strokeWidth={2} d="M9 7V5h6v2M8 11l8 8" />
  </svg>
);

export const EyedropperIcon = (p: IconProps) =>
  stroke(p, 'M4 20l4-4M14 4l6 6-8 8H6v-6l8-8z');

export const PencilIcon = (p: IconProps) =>
  stroke(p, 'M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z');

export const WandIcon = (p: IconProps) =>
  stroke(p, 'M15 4l2 2m-6 6l-4 4 2 2 4-4m4-8l2 2M3 21l2-2');

export const BucketIcon = (p: IconProps) => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...p}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M7 4l10 10-3 3L4 7l3-3zm0 0L4 7M19 15a2 2 0 100 4 2 2 0 000-4z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M17 13l2 2" />
  </svg>
);

export const UndoIcon = (p: IconProps) => stroke(p, 'M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4');
export const RedoIcon = (p: IconProps) => stroke(p, 'M21 10H11a5 5 0 00-5 5v2M21 10l-4-4M21 10l-4 4');

export const ContrastIcon = (p: IconProps) => (
  <svg fill="currentColor" viewBox="0 0 24 24" {...p}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18V4c4.42 0 8 3.58 8 8s-3.58 8-8 8z" />
  </svg>
);

export const BackIcon = (p: IconProps) => stroke(p, 'M15 18l-6-6 6-6');

export const ImageIcon = (p: IconProps) => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} />
    <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
    <path strokeWidth={2} d="M21 15l-5-5L5 21" />
  </svg>
);

export const ImportIcon = (p: IconProps) =>
  stroke(p, 'M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0 0l-4-4m4 4l4-4');

export const CalculatorIcon = (p: IconProps) => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...p}>
    <rect x="4" y="2" width="16" height="20" rx="2" strokeWidth={2} />
    <path strokeWidth={2} d="M8 6h8M8 10h8M8 14h4" />
  </svg>
);

export const SettingsIcon = (p: IconProps) => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...p}>
    <circle cx="12" cy="12" r="3" strokeWidth={2} />
    <path
      strokeWidth={2}
      d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
    />
  </svg>
);

export const PlusIcon = (p: IconProps) => stroke(p, 'M12 5v14M5 12h14');
export const SectionIcon = (p: IconProps) => stroke(p, 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z');

// Marker tool — cross-stitch X mark inside a circle
export const TrashIcon = (p: IconProps) => stroke(p, 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6');
export const TargetIcon = (p: IconProps) => stroke(p, 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M12 2v2M12 20v2M2 12h2M20 12h2');

export const MarkerIcon = (p: IconProps) => (
  <svg {...p} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9" />
    <path d="M8 8l8 8M16 8l-8 8" />
  </svg>
);
