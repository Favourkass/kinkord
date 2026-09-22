export interface TypingDotsProps {
  visible: boolean;
  label: string;
}

export default function TypingDots({ visible, label }: TypingDotsProps) {
  if (!visible) return null;
  return (
    <p
      aria-live="polite"
      className="flex items-center gap-[6px] px-[24px] py-[6px] text-[12px] italic text-app-muted"
    >
      <span className="flex gap-[3px]">
        <span className="block size-[4px] animate-pulse rounded-full bg-current" />
        <span className="block size-[4px] animate-pulse rounded-full bg-current [animation-delay:120ms]" />
        <span className="block size-[4px] animate-pulse rounded-full bg-current [animation-delay:240ms]" />
      </span>
      {label}
    </p>
  );
}
