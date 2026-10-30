// src/components/Icon.tsx
// Stroke icon set (24-grid), ported 1:1 from oxxito-ui.jsx ICONS map.
import React from 'react';
import Svg, { Path } from 'react-native-svg';

export const ICONS: Record<string, string> = {
  badge: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM8 9.5h3M8 13h5M15.5 9.2a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z',
  lock: 'M6 10V8a6 6 0 0 1 12 0v2M5 10h14v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1zM12 14v3',
  eye: 'M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12zM12 9.3a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4z',
  chevL: 'M14.5 5 8 12l6.5 7',
  chevR: 'M9.5 5 16 12l-6.5 7',
  arrowR: 'M5 12h13M13 6l6 6-6 6',
  check: 'M5 12.5 10 17.5 19 7',
  close: 'M6 6l12 12M18 6 6 18',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20V7',
  bell: 'M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6M9.5 19a2.5 2.5 0 0 0 5 0',
  shield: 'M12 3 5 6v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z',
  doc: 'M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM13 3v5h5M9 13h6M9 16.5h6',
  book: 'M5 5a2 2 0 0 1 2-2h11v15H7a2 2 0 0 0-2 2zM5 19a2 2 0 0 1 2-2h11',
  clipboard: 'M9 4h6v3H9zM8 5H6a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2M9 12h6M9 15.5h4',
  gift: 'M4 11h16v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM3.5 8h17v3h-17zM12 8v12M12 8S10.5 4 8 4a2 2 0 0 0 0 4M12 8s1.5-4 4-4a2 2 0 0 1 0 4',
  send: 'M4 11.5 20 4l-6.5 16-3-7z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  clip: 'M20 11.5 12 19.5a4 4 0 0 1-6-6l8-8a2.6 2.6 0 0 1 4 4l-8 8a1.2 1.2 0 0 1-2-1.5l7-7',
  mic: 'M12 4a2.5 2.5 0 0 0-2.5 2.5v5a2.5 2.5 0 0 0 5 0v-5A2.5 2.5 0 0 0 12 4zM6 11a6 6 0 0 0 12 0M12 17v3',
  clock: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8v4.5l3 2',
  shirt: 'M8 4 5 6 3.5 9 6 11v9h12v-9l2.5-2L18 6l-3-2-3 2.5z',
  calendar: 'M5 6h14v14H5zM5 10h14M9 3v4M15 3v4',
  plane: 'M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V18l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-4.5z',
  user: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM5 20a7 7 0 0 1 14 0',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 4l.7 2 .7-2 .7-.7-2-.7-.7-2-.7 2-2 .7z',
  pin: 'M12 21s7-5.5 7-11a7 7 0 0 0-14 0c0 5.5 7 11 7 11zM12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  fingerprint: 'M12 4a6 6 0 0 0-6 6v4M9 8a4 4 0 0 1 7 3v3M12 11v4M18 11v3M6 18a14 14 0 0 0 .5 2',
  shieldCheck: 'M12 3 5 6v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6zM9 11.5 11.2 14 15 9.5',
  faceId: 'M5 9V6a1 1 0 0 1 1-1h3M15 5h3a1 1 0 0 1 1 1v3M19 15v3a1 1 0 0 1-1 1h-3M9 19H6a1 1 0 0 1-1-1v-3M9 9.5v1.5M15 9.5v1.5M12 9.5v3l-1 1M9.5 15s1 1.2 2.5 1.2S14.5 15 14.5 15',
  globe: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM4 12h16M12 4c2.5 2.5 2.5 13.5 0 16M12 4c-2.5 2.5-2.5 13.5 0 16',
  phone: 'M6.5 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16 16 0 0 1 4.5 6.2 2 2 0 0 1 6.5 4z',
  headset: 'M5 13v-1a7 7 0 0 1 14 0v1M4 13h2v5H5a1 1 0 0 1-1-1zM20 13h-2v5h1a1 1 0 0 0 1-1zM18 18v.5a3 3 0 0 1-3 3h-3',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2.5l1.4 2.3 2.6-.5.6 2.6 2.3 1.4-1 2.4 1 2.4-2.3 1.4-.6 2.6-2.6-.5L12 21.5l-1.4-2.3-2.6.5-.6-2.6L5.1 15.7l1-2.4-1-2.4 2.3-1.4.6-2.6 2.6.5z',
  logout: 'M15 5h3a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-3M10 8l-4 4 4 4M6 12h10',
  history: 'M4 12a8 8 0 1 0 2.4-5.7M4 4v3h3M12 8v4.5l3 2',
  alert: 'M12 4 3 19h18zM12 10v4M12 16.5v.5',
  message: 'M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 3.5V6a1 1 0 0 1 1-1z',
  help: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM9.6 9.3a2.4 2.4 0 0 1 4.7.7c0 1.6-2.3 2-2.3 3.3M12 16.5v.3',
  home: 'M4 11 12 4l8 7M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9',
  star: 'M12 3.5 14.3 9l6 .4-4.6 3.9 1.5 5.8L12 16l-5.2 3.1 1.5-5.8L3.7 9.4l6-.4z',
  edit: 'M5 19h3l9.5-9.5-3-3L5 16zM14.5 6.5l3 3',
  key: 'M14 7a4 4 0 1 0-3.5 4l1.5 1.5 2 .5.5 2 2 .5.5 2H17l1-1v-2l-1.5-1.5A4 4 0 0 0 14 7z',
  chat: 'M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 3.5V6a1 1 0 0 1 1-1zM9 10h6M9 12.5h3',
  copy: 'M9 9h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zM6 15H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v1',
  whatsapp: 'M12 4a8 8 0 0 0-6.9 12L4 20l4.1-1.1A8 8 0 1 0 12 4zM9 9c.2-.5.4-.5.7-.5h.5c.2 0 .4 0 .6.5l.6 1.4c.1.2 0 .4-.1.5l-.4.5c-.1.1-.2.3 0 .6a5 5 0 0 0 2.3 2c.3.2.5.1.6 0l.5-.6c.2-.2.3-.1.5-.1l1.3.7c.2.1.3.2.3.3 0 .4-.2 1-.5 1.2-.3.3-.9.5-1.4.4a7 7 0 0 1-5.6-5.2c-.1-.5 0-1 .3-1.4z',
  clockRing: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8v4.5l3 2',
};

type IconProps = {
  name: keyof typeof ICONS | string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: boolean;
};

export function Icon({ name, size = 22, color = '#241A17', strokeWidth = 1.8, fill = false }: IconProps) {
  const d = ICONS[name];
  if (!d) return null;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={d}
        fill={fill ? color : 'none'}
        stroke={fill ? 'none' : color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
