import { useEffect, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";

export type MountShadowReactOptions = {
  hostId: string;
  hostStyle?: Partial<CSSStyleDeclaration>;
  App: ComponentType;
  styles: Array<{ key: string; css: string }>;
};

export type ShadowMount = {
  host: HTMLElement;
  shadow: ShadowRoot;
  root: Root;
};

const mounts = new Map<string, ShadowMount>();

function ShadowStyleInjector({
  shadow,
  styles,
}: {
  shadow: ShadowRoot;
  styles: Array<{ key: string; css: string }>;
}) {
  useEffect(() => {
    for (const entry of styles) {
      if (shadow.querySelector(`style[data-styles="${entry.key}"]`)) {
        continue;
      }

      const style = document.createElement("style");
      style.setAttribute("data-styles", entry.key);
      style.textContent = entry.css;
      shadow.appendChild(style);
    }
  }, [shadow, styles]);

  return null;
}

function createShadowHost(options: MountShadowReactOptions): ShadowMount {
  let host = document.getElementById(options.hostId);
  if (!host) {
    host = document.createElement("div");
    host.id = options.hostId;
    document.documentElement.appendChild(host);
  }

  if (options.hostStyle) {
    Object.assign(host.style, options.hostStyle);
  }

  const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  let reactHost = shadow.querySelector("#react-root") as HTMLElement | null;
  if (!reactHost) {
    reactHost = document.createElement("div");
    reactHost.id = "react-root";
    shadow.appendChild(reactHost);
  }

  const App = options.App;
  const root = createRoot(reactHost);
  root.render(
    <>
      <ShadowStyleInjector shadow={shadow} styles={options.styles} />
      <App />
    </>,
  );

  return { host, shadow, root };
}

export function ensureShadowReactMount(
  options: MountShadowReactOptions,
): ShadowMount {
  const existing = mounts.get(options.hostId);
  if (existing) {
    return existing;
  }

  const mount = createShadowHost(options);
  mounts.set(options.hostId, mount);
  return mount;
}

export function destroyShadowReactMount(hostId: string): void {
  const mount = mounts.get(hostId);
  if (!mount) {
    document.getElementById(hostId)?.remove();
    return;
  }

  mount.root.unmount();
  mount.host.remove();
  mounts.delete(hostId);
}

export function getShadowReactMount(hostId: string): ShadowMount | null {
  return mounts.get(hostId) ?? null;
}

export function isShadowHostMounted(hostId: string): boolean {
  return Boolean(document.getElementById(hostId));
}
