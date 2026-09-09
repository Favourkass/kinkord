import type { CSSProperties } from "react";

/** Figma-exported icon files under /public/app/members (geometry preserved 1:1). */
export type MaskIconName =
  | "hamburger"
  | "search"
  | "globe"
  | "chevron-right"
  | "chevron-right-14"
  | "chevron-right-24"
  | "chevron-right-gray"
  | "home-solid"
  | "chat"
  | "bell"
  | "bell-outline"
  | "bell-outline-24"
  | "pin-small"
  | "list"
  | "sort"
  | "filter"
  | "location-outline"
  | "people"
  | "settings"
  | "logout"
  | "nav-search"
  | "nav-more"
  | "nav-share"
  | "plus"
  | "map-pin"
  | "person-add"
  | "message"
  | "user-check"
  | "more-vertical";

export interface MaskIconProps {
  name: MaskIconName;
  width: number;
  height?: number;
  /** Tailwind text-* class: the icon paints in `currentColor`. */
  className?: string;
  /** Accessible name; omit for purely decorative icons. */
  label?: string;
}

/**
 * Renders a Figma SVG export through a CSS mask so the exact designed glyph is
 * kept while its colour follows the theme (light/dark) via `currentColor`.
 */
export default function MaskIcon({ name, width, height = width, className, label }: MaskIconProps) {
  const url = `url(/app/members/icon-${name}.svg)`;
  const style: CSSProperties = {
    width,
    height,
    WebkitMaskImage: url,
    maskImage: url,
    WebkitMaskSize: "contain",
    maskSize: "contain",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
  };
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`inline-block shrink-0 bg-current ${className ?? ""}`}
      style={style}
    />
  );
}
