import type { CSSProperties, ReactNode, RefObject } from "react";

type OverlayHostProps = {
  hostRef?: RefObject<HTMLDivElement | null>;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

export function OverlayHost({
  hostRef,
  className,
  style,
  children,
}: OverlayHostProps) {
  return (
    <div ref={hostRef} className={className} style={style}>
      {children}
    </div>
  );
}
