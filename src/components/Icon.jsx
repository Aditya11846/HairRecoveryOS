import React from 'react';
import Svg, { Path, Circle, Line, Polyline, Rect } from 'react-native-svg';

const DEFAULT_SIZE = 20;
const DEFAULT_COLOR = '#F5F5F7';
const SW = 1.8;

function I({ size, color, children }) {
  const s = size || DEFAULT_SIZE;
  const c = color || DEFAULT_COLOR;
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      {React.Children.map(children, child =>
        React.cloneElement(child, {
          stroke: child.props.stroke || c,
          strokeWidth: child.props.strokeWidth || SW,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        })
      )}
    </Svg>
  );
}

// pill (oral medication)
export function Pill({ size, color }) {
  return (
    <I size={size} color={color}>
      <Path d="M10.5 20.5L3.5 13.5a4.95 4.95 0 017-7l7 7a4.95 4.95 0 01-7 7z" />
      <Line x1="9" y1="9" x2="15" y2="15" />
    </I>
  );
}

// droplet (topical)
export function Droplet({ size, color }) {
  return (
    <I size={size} color={color}>
      <Path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />
    </I>
  );
}

// sun / red light
export function Sun({ size, color }) {
  return (
    <I size={size} color={color}>
      <Circle cx="12" cy="12" r="4" />
      <Line x1="12" y1="2" x2="12" y2="4" />
      <Line x1="12" y1="20" x2="12" y2="22" />
      <Line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <Line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <Line x1="2" y1="12" x2="4" y2="12" />
      <Line x1="20" y1="12" x2="22" y2="12" />
      <Line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <Line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </I>
  );
}

// flask (labs)
export function Flask({ size, color }) {
  return (
    <I size={size} color={color}>
      <Path d="M9 3h6M10 3v7L6 17a2 2 0 001.8 2.9h8.4A2 2 0 0018 17l-4-7V3" />
      <Line x1="7" y1="13" x2="17" y2="13" />
    </I>
  );
}

// dna / research
export function Dna({ size, color }) {
  return (
    <I size={size} color={color}>
      <Path d="M2 15C7 15 7 9 12 9s5 6 10 6" />
      <Path d="M2 9c5 0 5 6 10 6s5-6 10-6" />
    </I>
  );
}

// butterfly (hair / growth)
export function Butterfly({ size, color }) {
  return (
    <I size={size} color={color}>
      <Path d="M12 12C8 12 4 9 4 5s4-3 8 7c4-10 8-11 8-7s-4 7-8 7z" />
      <Path d="M12 12v6" />
    </I>
  );
}

// check
export function Check({ size, color }) {
  return (
    <I size={size} color={color}>
      <Polyline points="20 6 9 17 4 12" />
    </I>
  );
}

// circle (empty)
export function CircleIcon({ size, color }) {
  return (
    <I size={size} color={color}>
      <Circle cx="12" cy="12" r="9" />
    </I>
  );
}

// search
export function Search({ size, color }) {
  return (
    <I size={size} color={color}>
      <Circle cx="11" cy="11" r="7" />
      <Line x1="20" y1="20" x2="16.65" y2="16.65" />
    </I>
  );
}

// grid / overview
export function Grid({ size, color }) {
  return (
    <I size={size} color={color}>
      <Rect x="3" y="3" width="7" height="7" rx="1.5" />
      <Rect x="14" y="3" width="7" height="7" rx="1.5" />
      <Rect x="3" y="14" width="7" height="7" rx="1.5" />
      <Rect x="14" y="14" width="7" height="7" rx="1.5" />
    </I>
  );
}

// chart / progress
export function Chart({ size, color }) {
  return (
    <I size={size} color={color}>
      <Polyline points="3 17 8 10 13 14 18 5 22 9" />
    </I>
  );
}

// chat / claude
export function Chat({ size, color }) {
  return (
    <I size={size} color={color}>
      <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </I>
  );
}

// log / checkin
export function LogIcon({ size, color }) {
  return (
    <I size={size} color={color}>
      <Rect x="3" y="3" width="18" height="18" rx="4" />
      <Path d="M8.5 12l2.5 2.5 4.5-5" />
    </I>
  );
}

// star (bookmark)
export function Star({ size, color, filled }) {
  return (
    <Svg width={size || DEFAULT_SIZE} height={size || DEFAULT_SIZE} viewBox="0 0 24 24" fill={filled ? (color || DEFAULT_COLOR) : 'none'}>
      <Path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        stroke={color || DEFAULT_COLOR}
        strokeWidth={SW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// cigarette (damage indicator)
export function Cigarette({ size, color }) {
  return (
    <I size={size} color={color}>
      <Path d="M18 12H2v4h16v-4z" />
      <Line x1="22" y1="12" x2="22" y2="16" />
      <Line x1="20" y1="12" x2="20" y2="16" />
      <Path d="M20 9c0-2-2-3.5-2-6" />
      <Path d="M22 9c0-2-2-3.5-2-6" />
    </I>
  );
}

// moon / sleep
export function Moon({ size, color }) {
  return (
    <I size={size} color={color}>
      <Path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </I>
  );
}

// stress / lightning
export function Lightning({ size, color }) {
  return (
    <I size={size} color={color}>
      <Polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </I>
  );
}

// bookmark (saved)
export function Bookmark({ size, color, filled }) {
  return (
    <Svg width={size || DEFAULT_SIZE} height={size || DEFAULT_SIZE} viewBox="0 0 24 24" fill={filled ? (color || DEFAULT_COLOR) : 'none'}>
      <Path
        d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"
        stroke={color || DEFAULT_COLOR}
        strokeWidth={SW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// external link
export function ExternalLink({ size, color }) {
  return (
    <I size={size} color={color}>
      <Path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <Polyline points="15 3 21 3 21 9" />
      <Line x1="10" y1="14" x2="21" y2="3" />
    </I>
  );
}

// shield / dutasteride
export function Shield({ size, color }) {
  return (
    <I size={size} color={color}>
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </I>
  );
}

// plus / add insight
export function Plus({ size, color }) {
  return (
    <I size={size} color={color}>
      <Line x1="12" y1="5" x2="12" y2="19" />
      <Line x1="5" y1="12" x2="19" y2="12" />
    </I>
  );
}
