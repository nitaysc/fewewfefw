import type { CSSProperties } from 'react';

const PATHS = {
  home: 'M4 11.2 12 4l8 7.2V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z',
  calendar: 'M5 6.5h14a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7.5a1 1 0 0 1 1-1zM4 10.5h16M8.5 4v4M15.5 4v4',
  trophy: 'M8 4.5h8v5a4 4 0 0 1-8 0zM8 6H5v1.5A3.5 3.5 0 0 0 8.4 11M16 6h3v1.5a3.5 3.5 0 0 1-3.4 3.5M12 13.5V17M8.5 20h7M9.5 17h5',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2.1-1.2L14 3h-4l-.4 2.6a7 7 0 0 0-2.1 1.2l-2.4-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.4-.9a7 7 0 0 0 2 1.2L10 21h4l.4-2.6a7 7 0 0 0 2.1-1.2l2.4.9 2-3.4-2-1.5q.1-.6.1-1.2z',
  flame: 'M12 3c.5 3-1.2 4.6-2.6 6.2C8 10.800 7 12.300 7 14.500a5 5 0 0 0 10 0c0-1.700-.6-3-1.500-4.200-.4 1.200-1 1.900-2 2.200.5-3.500-.5-7-1.500-9.500z',
  close: 'M6 6l12 12M18 6 6 18',
  back: 'M14.500 5.500 8 12l6.500 6.500',
  chevron: 'M9.500 5.500 16 12l-6.500 6.500',
  check: 'M5 12.500 10 17.500 19.500 7',
  share: 'M12 15V4M8 7.500 12 3.500l4 4M5 12.500V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6.500',
  play: 'M8 5.500v13l11-6.500z',
  clock: 'M12 20.500a8.500 8.500 0 1 0 0-17 8.500 8.500 0 0 0 0 17zM12 7.500V12l3 2',
  bolt: 'M13 3 5 13.500h6L10 21l8.500-11h-6z',
  copy: 'M9 9h10a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zM16 9V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3',
  users: 'M9 11.500a3.500 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7zM2.500 20a6.500 6.500 0 0 1 13 0M16 4.300a3.500 3.500 0 0 1 0 6.900M18 14.200a6.500 6.500 0 0 1 3.500 5.800',
  plus: 'M12 5v14M5 12h14',
  delete: 'M9 5.500h10a1.500 1.500 0 0 1 1.500 1.500v10a1.500 1.500 0 0 1-1.500 1.500H9L3 12zM12 9.500l5 5M17 9.500l-5 5',
  refresh: 'M19.500 12a7.500 7.500 0 1 1-2.300-5.400M19.500 4v4h-4',
  star: 'M12 3.500l2.600 5.400 5.900.8-4.300 4.100 1 5.900L12 16.900l-5.200 2.800 1-5.900L3.500 9.700l5.900-.8z',
  code: 'M5 8.500h14M5 15.500h14M9.500 4 8 20M16 4l-1.500 16',
  eye: 'M2.500 12S6 5.500 12 5.500 21.500 12 21.500 12 18 18.500 12 18.500 2.500 12 2.500 12zM12 14.500a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5z',
  target: 'M12 20.500a8.500 8.500 0 1 0 0-17 8.500 8.500 0 0 0 0 17zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
  grid: 'M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM16.500 14 19 16.500 16.500 19 14 16.500z',
  info: 'M12 20.500a8.500 8.500 0 1 0 0-17 8.500 8.500 0 0 0 0 17zM12 11v5.500M12 7.700v.100',
  pencil: 'M4 20l1-4.500L16.500 4l3.500 3.500L8.500 19zM14 6.500l3.500 3.500',
} as const;

export type IconName = keyof typeof PATHS;

interface Props {
  name: IconName;
  size?: number;
  filled?: boolean;
  style?: CSSProperties;
  className?: string;
}

export function Icon({ name, size = 22, filled = false, style, className }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style} className={className}>
      <path d={PATHS[name]} />
    </svg>
  );
}
