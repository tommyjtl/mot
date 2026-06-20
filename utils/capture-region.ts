import type { SelectionRect } from "./messages";

export type ViewportCaptureRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type ViewportCaptureSelection = {
  rect: ViewportCaptureRect;
  devicePixelRatio: number;
};

const CAPTURE_OVERLAY_ID = "mot-capture-overlay-host";
const MIN_CAPTURE_SIZE_PX = 12;

export function viewportRectToSelectionRect(
  rect: ViewportCaptureRect,
): SelectionRect {
  return {
    top: rect.top,
    left: rect.left,
    bottom: rect.top + rect.height,
    right: rect.left + rect.width,
    width: rect.width,
    height: rect.height,
  };
}

export function showCaptureOverlay(
  requestId: number,
): Promise<ViewportCaptureSelection | null> {
  hideCaptureOverlay();

  return new Promise((resolve) => {
    const host = document.createElement("div");
    host.id = CAPTURE_OVERLAY_ID;
    host.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:2147483646",
      "cursor:crosshair",
      "touch-action:none",
    ].join(";");

    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host {
          all: initial;
        }

        .mask {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
        }

        .hint {
          position: fixed;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          margin: 0;
          padding: 8px 14px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.88);
          color: #f8fafc;
          font: 500 13px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          pointer-events: none;
          white-space: nowrap;
        }

        .selection {
          position: fixed;
          display: none;
          border: 2px solid #fff;
          background: rgba(255, 255, 255, 0.08);
          box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.4);
          pointer-events: none;
        }
      </style>
      <div class="mask" part="mask"></div>
      <p class="hint">Drag to select text · Esc to cancel</p>
      <div class="selection"></div>
    `;

    const selectionEl = shadow.querySelector(".selection") as HTMLElement;
    let anchorX = 0;
    let anchorY = 0;
    let dragPointerId: number | null = null;
    let isDragging = false;
    let settled = false;

    const finish = (value: ViewportCaptureSelection | null): void => {
      if (settled) {
        return;
      }
      settled = true;
      hideCaptureOverlay();
      window.removeEventListener("keydown", onKeyDown, true);
      resolve(value);
    };

    const updateSelection = (left: number, top: number, width: number, height: number): void => {
      selectionEl.style.display = "block";
      selectionEl.style.left = `${left}px`;
      selectionEl.style.top = `${top}px`;
      selectionEl.style.width = `${Math.max(width, 0)}px`;
      selectionEl.style.height = `${Math.max(height, 0)}px`;
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        finish(null);
      }
    };

    host.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || settled) {
        return;
      }

      anchorX = event.clientX;
      anchorY = event.clientY;
      dragPointerId = event.pointerId;
      isDragging = true;
      host.setPointerCapture(event.pointerId);
      updateSelection(anchorX, anchorY, 0, 0);
      event.preventDefault();
      event.stopPropagation();
    });

    host.addEventListener("pointermove", (event) => {
      if (!isDragging || dragPointerId !== event.pointerId || settled) {
        return;
      }

      const left = Math.min(anchorX, event.clientX);
      const top = Math.min(anchorY, event.clientY);
      const width = Math.abs(event.clientX - anchorX);
      const height = Math.abs(event.clientY - anchorY);
      updateSelection(left, top, width, height);
      event.preventDefault();
      event.stopPropagation();
    });

    const onPointerFinish = (event: PointerEvent): void => {
      if (!isDragging || dragPointerId !== event.pointerId || settled) {
        return;
      }

      isDragging = false;
      dragPointerId = null;
      host.releasePointerCapture(event.pointerId);

      const left = Math.min(anchorX, event.clientX);
      const top = Math.min(anchorY, event.clientY);
      const width = Math.abs(event.clientX - anchorX);
      const height = Math.abs(event.clientY - anchorY);

      event.preventDefault();
      event.stopPropagation();

      if (width < MIN_CAPTURE_SIZE_PX || height < MIN_CAPTURE_SIZE_PX) {
        finish(null);
        return;
      }

      finish({
        rect: { left, top, width, height },
        devicePixelRatio: window.devicePixelRatio || 1,
      });
    };

    host.addEventListener("pointerup", onPointerFinish);
    host.addEventListener("pointercancel", onPointerFinish);

    window.addEventListener("keydown", onKeyDown, true);
    document.documentElement.appendChild(host);

    void requestId;
  });
}

export function hideCaptureOverlay(): void {
  document.getElementById(CAPTURE_OVERLAY_ID)?.remove();
}

export function isCaptureOverlayVisible(): boolean {
  return document.getElementById(CAPTURE_OVERLAY_ID) !== null;
}
