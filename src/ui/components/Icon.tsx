import type { JSX } from 'react';

const P: Record<string, JSX.Element> = {
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  map: <><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" /><path d="M9 4v14M15 6v14" /></>,
  route: <><circle cx="6" cy="19" r="2.5" /><circle cx="18" cy="5" r="2.5" /><path d="M8.5 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></>,
  shield: <><path d="M12 3 4 6v6c0 4.5 3.2 8 8 9 4.8-1 8-4.5 8-9V6l-8-3Z" /><path d="M12 8v5M12 16v.5" /></>,
  gps: <><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="8" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
  offline: <><path d="M3 3l18 18" /><path d="M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 3-2M19 13a10 10 0 0 0-5.5-3M2 9.5a15 15 0 0 1 4-2.5M22 9.5a15 15 0 0 0-9-3.4" /><path d="M12 20h.01" /></>,
  check: <path d="m4 12 5 5L20 6" />,
  alert: <><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v5M12 17.5v.5" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></>,
  chevron: <path d="m9 5 7 7-7 7" />,
  car: <><path d="M5 16V11l2-5h10l2 5v5" /><path d="M3 16h18v3H3zM7 13h.01M17 13h.01" /></>,
  walk: <><circle cx="13" cy="4.5" r="1.8" /><path d="m9 21 2-6-2-3 1-5 3 1 2 4 3 1M13 8l-3 2-1 4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  share: <><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" /></>,
  download: <><path d="M12 3v12m0 0-4-4m4 4 4-4" /><path d="M4 19h16" /></>,
  upload: <><path d="M12 15V3m0 0-4 4m4-4 4 4" /><path d="M4 19h16" /></>,
  phone: <path d="M6 3h4l2 5-2.5 1.5a11 11 0 0 0 5 5L16 12l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2Z" />,
  drop: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" />,
  mountain: <path d="m3 20 6-11 4 6 2-3 6 8H3Z" />,
  camera: <><path d="M4 8h3l2-3h6l2 3h3v12H4V8Z" /><circle cx="12" cy="13" r="3.5" /></>,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.5" /></>,
  fit: <><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></>,
  close: <path d="M5 5l14 14M19 5 5 19" />,
  refresh: <><path d="M20 11a8 8 0 0 0-14-4M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14 4M20 20v-4h-4" /></>,
  bridge: <><path d="M2 14c4 0 6-6 10-6s6 6 10 6" /><path d="M2 18h20M7 12v6M12 8v10M17 12v6" /></>,
  fork: <><path d="M12 21v-9M12 12 6 5M12 12l6-7" /></>,
  waterfall: <><path d="M5 3h14M8 3v8M12 3v10M16 3v8" /><path d="M5 17c2-1.5 4 1.500 7 0s5-1.500 7 0M5 21c2-1.500 4 1.500 7 0s5-1.500 7 0" /></>,
  hut: <><path d="M3 12 12 4l9 8" /><path d="M5 11v9h14v-9M10 20v-5h4v5" /></>,
  parking: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M10 16V8h3a2.500 2.500 0 0 1 0 5h-3" /></>,
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
};

export type IconName = keyof typeof P;

export function Icon({ name, label, size = 24 }: { name: IconName; label?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {P[name]}
    </svg>
  );
}
