/**
 * Minimal inline icon set. Stroke-based, sized by the parent via className,
 * decorative by default (aria-hidden) — pair with visible text or aria-labels.
 */

interface IconProps {
  className?: string;
  strokeWidth?: number;
}

function Svg({
  className,
  strokeWidth = 1.75,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-4 w-4"}
    >
      {children}
    </svg>
  );
}

export function IconLock(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Svg>
  );
}

export function IconUpload(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 16V4" />
      <path d="m6 9 6-6 6 6" />
      <path d="M4 20h16" />
    </Svg>
  );
}

export function IconCamera(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 8h3l2-3h6l2 3h3v12H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </Svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m5 13 4 4L19 7" />
    </Svg>
  );
}

export function IconX(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}

export function IconAlert(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 7v6" />
      <path d="M12 16.5h.01" strokeWidth={2.5} />
    </Svg>
  );
}

export function IconDownload(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4v12" />
      <path d="m6 11 6 6 6-6" />
      <path d="M4 20h16" />
    </Svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Svg>
  );
}

export function IconReset(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 8a9 9 0 1 1-.5 4" />
      <path d="M3 3v5h5" />
    </Svg>
  );
}

export function IconSun(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
    </Svg>
  );
}

export function IconMoon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
    </Svg>
  );
}

export function IconMonitor(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="4.5" width="18" height="13" rx="2" />
      <path d="M9 21h6M12 17.5V21" />
    </Svg>
  );
}

/** App mark: an ID-photo frame with head-height guides. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 32 32"
      fill="none"
      className={className ?? "h-8 w-8"}
    >
      <rect
        x="4.5"
        y="2.5"
        width="23"
        height="27"
        rx="4"
        fill="#EEF3FE"
        stroke="#1D4ED8"
        strokeWidth="1.6"
      />
      <circle cx="16" cy="13" r="4.2" stroke="#1D4ED8" strokeWidth="1.6" />
      <path
        d="M9 25c1.3-3.4 4-5 7-5s5.7 1.6 7 5"
        stroke="#1D4ED8"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M25 9v8"
        stroke="#1D4ED8"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.45"
      />
    </svg>
  );
}
