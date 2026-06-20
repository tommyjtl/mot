import type { ReactNode } from "react";

type IconButtonProps = {
  label: string;
  title?: string;
  hidden?: boolean;
  active?: boolean;
  className?: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onPointerDown?: (event: React.PointerEvent<HTMLButtonElement>) => void;
  children: ReactNode;
};

export function IconButton({
  label,
  title,
  hidden,
  active,
  className,
  onClick,
  onPointerDown,
  children,
}: IconButtonProps) {
  if (hidden) {
    return null;
  }

  return (
    <button
      type="button"
      className={`iconButton${active ? " isActive" : ""}${className ? ` ${className}` : ""}`}
      aria-label={label}
      title={title ?? label}
      onClick={onClick}
      onPointerDown={onPointerDown}
    >
      {children}
    </button>
  );
}

export const StopIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="6" y="6" width="12" height="12" rx="1.5" />
  </svg>
);

export const RecordIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="12" r="6" />
  </svg>
);

export const ResumeIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M8 5v14l11-7z" />
  </svg>
);

export const EditIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

export const CheckIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const ResetIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

export const SpeakerIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" stroke="none" />
    <path className="speakerWave speakerWave1" d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path className="speakerWave speakerWave2" d="M17.66 6.34a8 8 0 0 1 0 11.32" />
  </svg>
);

export const PlaybackStopIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="6" y="6" width="12" height="12" rx="1.5" />
  </svg>
);

export const PauseIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
);
