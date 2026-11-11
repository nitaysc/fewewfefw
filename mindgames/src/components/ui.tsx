import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { haptic } from '../services/haptics';
import { sfx } from '../services/sfx';
import logoMark from '../assets/logo-mark.png';
import { Icon, type IconName } from './Icon';

/* ── Button ─────────────────────────────────────────── */
interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger';
  size?: 'md' | 'lg' | 'sm';
  icon?: IconName;
  iconRight?: IconName;
  disabled?: boolean;
  block?: boolean;
  label?: string;
  className?: string;
}

export function Button({ children, onClick, variant = 'primary', size = 'md', icon, iconRight, disabled, block, label, className = '' }: ButtonProps) {
  return (
    <button
      type="button"
      className={`btn btn-${variant} btn-${size} ${block ? 'btn-block' : ''} ${className}`}
      disabled={disabled}
      aria-label={label}
      onClick={() => {
        haptic.tap();
        sfx.tap();
        onClick?.();
      }}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 19} />}
      <span>{children}</span>
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 16 : 19} />}
    </button>
  );
}

export function IconButton({ icon, label, onClick, className = '' }: { icon: IconName; label: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      className={`icon-btn ${className}`}
      aria-label={label}
      onClick={() => {
        haptic.tap();
        onClick();
      }}
    >
      <Icon name={icon} size={20} />
    </button>
  );
}

/* ── Logo ───────────────────────────────────────────── */
export function LogoMark({ size = 30 }: { size?: number }) {
  return <img src={logoMark} width={size} height={size} alt="" className="logo-mark" draggable={false} />;
}

export function Wordmark({ size = 26 }: { size?: number }) {
  return (
    <span className="wordmark display" style={{ fontSize: size }}>
      MIND<span>GAMES</span>
    </span>
  );
}

/* ── Avatar ─────────────────────────────────────────── */
const AVATAR_BG = ['#ABA6FF', '#BDF26D', '#F4D98B', '#7FD8F0', '#FF9C8A', '#ECECF1', '#C9A6FF', '#8FE3B0'];
export const AVATAR_COUNT = AVATAR_BG.length;

export function Avatar({ index, size = 40, ring = false }: { index: number; size?: number; ring?: boolean }) {
  const i = ((index % AVATAR_COUNT) + AVATAR_COUNT) % AVATAR_COUNT;
  const ink = '#111114';
  const art = [
    <circle key="a" cx="20" cy="20" r="8" fill={ink} />,
    <path key="a" d="M8 28 20 9l12 19z" fill={ink} />,
    <path key="a" d="M10 10h20v20H10z" fill="none" stroke={ink} strokeWidth="5" />,
    <path key="a" d="M20 8a12 12 0 0 1 0 24z" fill={ink} />,
    <g key="a" fill={ink}>
      <circle cx="13" cy="13" r="4" />
      <circle cx="27" cy="13" r="4" />
      <circle cx="13" cy="27" r="4" />
      <circle cx="27" cy="27" r="4" />
    </g>,
    <path key="a" d="M20 7 33 20 20 33 7 20z" fill={ink} />,
    <g key="a" stroke={ink} strokeWidth="4.500" strokeLinecap="round">
      <path d="M12 11v18M20 11v18M28 11v18" />
    </g>,
    <g key="a" fill="none" stroke={ink} strokeWidth="4">
      <circle cx="20" cy="20" r="11" />
      <circle cx="20" cy="20" r="3" fill={ink} />
    </g>,
  ][i];
  return (
    <span className={`avatar ${ring ? 'avatar-ring' : ''}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
        <rect width="40" height="40" rx="20" fill={AVATAR_BG[i]} />
        {art}
      </svg>
    </span>
  );
}

/* ── CountUp ────────────────────────────────────────── */
const nf = new Intl.NumberFormat('en-US');

export function CountUp({ value, duration = 900, from = 0, delay = 0, format = (n: number) => nf.format(n) }: { value: number; duration?: number; from?: number; delay?: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(from);
  const frame = useRef(0);
  useEffect(() => {
    const still = document.documentElement.classList.contains('reduce-motion');
    if (still || duration <= 0) {
      setShown(value);
      return;
    }
    let start = 0;
    const step = (t: number) => {
      if (!start) start = t + delay;
      const p = Math.min(1, Math.max(0, (t - start) / duration));
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(from + (value - from) * eased));
      if (p < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [value, duration, from, delay]);
  return <span className="tnum">{format(shown)}</span>;
}

/* ── Progress bits ──────────────────────────────────── */
export function ProgressBar({ value, color, height = 6 }: { value: number; color?: string; height?: number }) {
  return (
    <div className="pbar" style={{ height }} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="pbar-fill" style={{ transform: `scaleX(${Math.max(0, Math.min(1, value))})`, background: color }} />
    </div>
  );
}

/** Three-segment ring used for daily completion. */
export function DailyRing({ done, size = 84, colors, children }: { done: boolean[]; size?: number; colors: string[]; children?: ReactNode }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const gap = 10;
  const seg = c / done.length - gap;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 84 84" width={size} height={size} aria-hidden="true">
        {done.map((d, i) => (
          <g key={i} transform={`rotate(${-90 + (360 / done.length) * i + (gap / c) * 180} 42 42)`}>
            <circle cx="42" cy="42" r={r} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${seg} ${c - seg}`} />
            <circle cx="42" cy="42" r={r} fill="none" stroke={colors[i]} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${seg} ${c - seg}`} className="ring-seg" style={{ strokeDashoffset: d ? 0 : seg, opacity: d ? 1 : 0 }} />
          </g>
        ))}
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

export function Pill({ children, tone = 'default', icon }: { children: ReactNode; tone?: 'default' | 'lime' | 'accent' | 'red'; icon?: IconName }) {
  return (
    <span className={`pill pill-${tone}`}>
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const index = Math.max(0, options.findIndex((o) => o.id === value));
  return (
    <div className="seg" role="tablist" style={{ '--n': options.length, '--i': index } as CSSProperties}>
      <span className="seg-thumb" />
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={o.id === value}
          className={o.id === value ? 'on' : ''}
          onClick={() => {
            haptic.tap();
            onChange(o.id);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── Bottom sheet ───────────────────────────────────── */
export function Sheet({ open, onClose, children, title, game }: { open: boolean; onClose: () => void; children: ReactNode; title?: string; game?: string }) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
      const id = window.setTimeout(() => setMounted(false), 220);
      return () => window.clearTimeout(id);
    }
  }, [open, mounted]);
  if (!mounted) return null;
  return (
    <div className={`sheet-wrap ${closing ? 'closing' : ''}`} data-game={game}>
      <div className="sheet-scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-grip" />
        {title && (
          <div className="row between sheet-head">
            <h2 className="display d-md">{title}</h2>
            <IconButton icon="close" label="Close" onClick={onClose} />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`toggle ${on ? 'on' : ''}`}
      onClick={() => {
        haptic.tap();
        onChange(!on);
      }}
    >
      <span />
    </button>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="row between section-title">
      <h2 className="display d-sm">{children}</h2>
      {action}
    </div>
  );
}
