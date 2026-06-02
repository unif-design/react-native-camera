import React from 'react';

// Stroke SVG icon set — viewBox 24, strokeWidth 1.75, round caps.
// All inherit currentColor.

type IconProps = { s?: number };

const _svg = (s: number, children: React.ReactNode): React.JSX.Element => (
  <svg
    width={s}
    height={s}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

// mark icon — Camera
export function IconCamera({ s = 24 }: IconProps): React.JSX.Element {
  return _svg(
    s,
    <>
      <path d="M4 8h3l2-3h6l2 3h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z" />
      <circle cx={12} cy={13} r={3.5} />
    </>
  );
}

// feature: 视频录制 — camcorder body + lens pointing right
export function IconVideo({ s = 24 }: IconProps): React.JSX.Element {
  return _svg(
    s,
    <>
      <rect x={2.5} y={7} width={13} height={10} rx={2.5} />
      <path d="M15.5 10.5l5-2.6v8.2l-5-2.6z" />
    </>
  );
}

// feature: 水印烧录 — image plane with baked-in mark
export function IconWatermark({ s = 24 }: IconProps): React.JSX.Element {
  return _svg(
    s,
    <>
      <rect x={3} y={4} width={18} height={16} rx={2.5} />
      <path d="M7 16l3.2-4 2.3 2.8L15 11l3 5" />
      <circle cx={8.5} cy={8.5} r={1.3} />
    </>
  );
}

// feature: 开箱即用 — spark / sun rays
export function IconSpark({ s = 24 }: IconProps): React.JSX.Element {
  return _svg(
    s,
    <>
      <path d="M12 3v3" />
      <path d="M12 18v3" />
      <path d="M5 12H2" />
      <path d="M22 12h-3" />
      <path d="M6 6l-2-2" />
      <path d="M20 20l-2-2" />
      <path d="M6 18l-2 2" />
      <path d="M20 4l-2 2" />
      <circle cx={12} cy={12} r={3} />
    </>
  );
}

// CTA: arrow right
export function IconArrowRight({ s = 24 }: IconProps): React.JSX.Element {
  return _svg(
    s,
    <>
      <path d="M5 12h14" />
      <path d="M13 5l7 7-7 7" />
    </>
  );
}

// install copy button
export function IconCopy({ s = 24 }: IconProps): React.JSX.Element {
  return _svg(
    s,
    <>
      <rect x={8} y={8} width={13} height={13} rx={2} />
      <path d="M4 16V5a2 2 0 0 1 2-2h11" />
    </>
  );
}

// install copy button: copied state
export function IconCheck({ s = 24 }: IconProps): React.JSX.Element {
  return _svg(s, <path d="M20 6L9 17l-5-5" />);
}
