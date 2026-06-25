import overlayBaseCss from "./overlay-base.css?inline";
import overlayTokensCss from "./overlay-tokens.css?inline";

/** Shared shadow-DOM styles injected before feature-specific overlay CSS. */
export const overlaySharedStyles = [
  { key: "overlay-tokens", css: overlayTokensCss },
  { key: "overlay-base", css: overlayBaseCss },
] as const;
