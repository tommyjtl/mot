import type { CSSProperties, ReactNode, RefObject } from "react";

type OverlayPanelProps = {
  panelRef?: RefObject<HTMLDivElement | null>;
  headerRef?: RefObject<HTMLElement | null>;
  headerProps?: {
    onPointerDown?: (event: React.PointerEvent<HTMLElement>) => void;
  };
  className?: string;
  style?: CSSProperties;
  ariaLabel: string;
  onClose?: () => void;
  showDragHandle?: boolean;
  headerLeft?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
};

export function OverlayPanel({
  panelRef,
  headerRef,
  headerProps,
  className,
  style,
  ariaLabel,
  onClose,
  showDragHandle = false,
  headerLeft,
  headerActions,
  children,
}: OverlayPanelProps) {
  return (
    <div ref={panelRef} className={className} style={style}>
      <header
        ref={headerRef}
        className="header"
        aria-label={ariaLabel}
        {...headerProps}
      >
        {showDragHandle ? (
          <div className="dragHandle" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        ) : null}
        {headerLeft}
        <div className="headerActions">
          {headerActions}
          {onClose ? (
            <button
              type="button"
              className="closeButton"
              aria-label="Close"
              title="Close"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onClose();
              }}
            >
              ×
            </button>
          ) : null}
        </div>
      </header>
      {children}
    </div>
  );
}
