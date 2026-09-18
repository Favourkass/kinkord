import type { SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement>;

/** User silhouette matching the reference "Account Settings" icon */
export function UserCircleIcon({ className = "size-5", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
      <path d="M12 12c2.48 0 4.5-2.02 4.5-4.5S14.48 3 12 3 7.5 5.02 7.5 7.5 9.52 12 12 12zm0 2.25c-3.01 0-9 1.51-9 4.5V21h18v-2.25c0-2.99-5.99-4.5-9-4.5z" />
    </svg>
  );
}

/** 3 ascending vertical rounded pill bars matching the reference "Your Data" icon */
export function DataBarsIcon({ className = "size-5", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
      <rect x="3" y="13" width="4" height="8" rx="1.5" />
      <rect x="10" y="8" width="4" height="13" rx="1.5" />
      <rect x="17" y="3" width="4" height="18" rx="1.5" />
    </svg>
  );
}

/** Solid padlock matching the reference "Privacy" icon */
export function LockFilledIcon({ className = "size-5", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
      <path
        fillRule="evenodd"
        d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3H6a2.25 2.25 0 00-2.25 2.25v8.25A2.25 2.25 0 006 22.5h12a2.25 2.25 0 002.25-2.25v-8.25A2.25 2.25 0 0018 9.75h-.75v-3A5.25 5.25 0 0012 1.5zm-3 5.25a3 3 0 016 0v3H9v-3zm3 7.5a1.5 1.5 0 011.5 1.5v2.25a1.5 1.5 0 01-3 0V15.75a1.5 1.5 0 011.5-1.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Solid shield with cutout checkmark matching "Security" and "Community & Safety" icons */
export function ShieldCheckFilledIcon({ className = "size-5", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
      <path
        fillRule="evenodd"
        d="M12 2.25l-7.5 3.375v5.625c0 5.062 3.206 9.806 7.5 11 4.294-1.194 7.5-5.938 7.5-11V5.625L12 2.25zm-1.06 13.06l-3.18-3.18 1.414-1.414 1.766 1.766 4.766-4.766 1.414 1.414-6.18 6.18z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Painter's palette with paint spots matching the reference "Content & Experience" icon */
export function PaletteFilledIcon({ className = "size-5", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
      <path
        fillRule="evenodd"
        d="M12 2.25C6.615 2.25 2.25 6.615 2.25 12c0 4.14 2.53 7.69 6.13 9.17.47.19.87-.19.87-.7v-1.14c0-.73.59-1.33 1.33-1.33h1.67c4.42 0 8-3.58 8-8 0-5.385-4.385-9.75-8-9.75zM6.5 11.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm3-4a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm3 4a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Lifebuoy ring matching the reference "Help & Support" icon */
export function LifeBuoyFilledIcon({ className = "size-5", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
      <path
        fillRule="evenodd"
        d="M12 2.25a9.75 9.75 0 100 19.5 9.75 9.75 0 000-19.5zm0 3.75a6 6 0 00-4.242 1.758L9.5 9.5a2.5 2.5 0 012.5-.5v-3zm1.5 0v3a2.5 2.5 0 012.5.5l1.742-1.742A6 6 0 0013.5 6zm4.242 3.258L16 11a2.5 2.5 0 01.5 2.5h3a6 6 0 00-1.758-4.242zM19.5 14.5h-3a2.5 2.5 0 01-.5 2.5l1.742 1.742A6 6 0 0019.5 14.5zm-3.258 4.242L14.5 17a2.5 2.5 0 01-2.5.5v3a6 6 0 004.242-1.758zM10.5 20.5v-3a2.5 2.5 0 01-2.5-.5l-1.742 1.742A6 6 0 0010.5 20.5zm-4.242-3.258L8 15.5a2.5 2.5 0 01-.5-2.5h-3a6 6 0 001.758 4.242zM4.5 11.5h3a2.5 2.5 0 01.5-2.5L6.258 7.258A6 6 0 004.5 11.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Subtle trailing chevron */
export function ChevronRightSmall({ className = "size-4", ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M7.5 4.5l5 5.5-5 5.5" />
    </svg>
  );
}
