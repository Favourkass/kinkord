import { Search } from "lucide-react";

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}

/** Rounded search input with a leading magnifier; controlled by the presenter. */
export default function SearchField({ value, onChange, placeholder, label }: SearchFieldProps) {
  return (
    <label className="relative block">
      <Search
        size={18}
        className="pointer-events-none absolute left-[14px] top-1/2 -translate-y-1/2 text-app-muted"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        className="h-[46px] w-full rounded-[12px] border border-app-input-border bg-app-input pl-[42px] pr-[14px] text-[15px] text-app-value placeholder:text-app-muted focus:border-kink-amber focus:outline-none"
      />
    </label>
  );
}
