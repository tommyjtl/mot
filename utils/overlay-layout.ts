export type PanelSize = {
  width: number;
  height: number;
};

export type ViewportSize = {
  width: number;
  height: number;
};

export type PanelPosition = {
  left: number;
  top: number;
};

export type SelectionRectLike = {
  top: number;
  left: number;
  bottom: number;
  right: number;
};

const DEFAULT_MARGIN = 8;

export function clampPanelPosition(
  panelSize: PanelSize,
  left: number,
  top: number,
  viewport: ViewportSize,
  margin = DEFAULT_MARGIN,
): PanelPosition {
  return {
    left: Math.max(
      margin,
      Math.min(left, viewport.width - panelSize.width - margin),
    ),
    top: Math.max(
      margin,
      Math.min(top, viewport.height - panelSize.height - margin),
    ),
  };
}

export function computeCardPositionNearSelection(
  selectionRect: SelectionRectLike,
  panelSize: PanelSize,
  viewport: ViewportSize,
  margin = DEFAULT_MARGIN,
): PanelPosition {
  let top = selectionRect.bottom + margin;
  let left = selectionRect.left;

  if (top + panelSize.height > viewport.height - margin) {
    top = selectionRect.top - panelSize.height - margin;
  }

  return clampPanelPosition(panelSize, left, top, viewport, margin);
}

export function computeTopRightPanelPosition(
  panelWidth: number,
  panelHeight: number,
  margin = 16,
): PanelPosition {
  const viewport: ViewportSize = {
    width: window.innerWidth,
    height: window.innerHeight,
  };

  return clampPanelPosition(
    { width: panelWidth, height: panelHeight },
    viewport.width - panelWidth - margin,
    margin,
    viewport,
    margin,
  );
}

export function defaultCardPosition(): PanelPosition & {
  right: number;
  bottom: string;
} {
  return {
    left: NaN,
    top: 16,
    right: 16,
    bottom: "auto",
  };
}

export function applyPanelPosition(
  panel: HTMLElement,
  left: number,
  top: number,
  clampToViewport: boolean,
): void {
  const viewport: ViewportSize = {
    width: window.innerWidth,
    height: window.innerHeight,
  };
  const panelSize: PanelSize = {
    width: panel.offsetWidth || panel.getBoundingClientRect().width,
    height: panel.offsetHeight || panel.getBoundingClientRect().height,
  };

  const resolved = clampToViewport
    ? clampPanelPosition(panelSize, left, top, viewport)
    : { left, top };

  panel.style.position = "fixed";
  panel.style.left = `${resolved.left}px`;
  panel.style.top = `${resolved.top}px`;
  panel.style.right = "auto";
  panel.style.bottom = "auto";
  panel.style.transform = "none";
}

export function positionCardNearSelection(
  card: HTMLElement,
  rect: SelectionRectLike,
): void {
  const viewport: ViewportSize = {
    width: window.innerWidth,
    height: window.innerHeight,
  };
  const panelSize: PanelSize = {
    width: card.offsetWidth || 280,
    height: card.offsetHeight || 80,
  };

  const { left, top } = computeCardPositionNearSelection(
    rect,
    panelSize,
    viewport,
  );

  applyPanelPosition(card, left, top, false);
}

export function placeCardDefault(card: HTMLElement): void {
  card.style.position = "fixed";
  card.style.top = "16px";
  card.style.right = "16px";
  card.style.left = "auto";
  card.style.bottom = "auto";
}
