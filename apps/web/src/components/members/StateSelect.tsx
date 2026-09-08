import type { StateRowVM } from "@/domain/member";
import MembersSearch from "./MembersSearch";

export interface StateSelectProps {
  title: string;
  subtitle: string;
  search: { value: string; onChange: (v: string) => void; placeholder: string; label: string };
  rows: StateRowVM[];
  membersSuffix: string;
  onSelect: (state: string) => void;
  selectLabel: (state: string) => string;
  continueLabel: string;
  canContinue: boolean;
  onContinue: () => void;
  noResults: string | null;
  notAvailable: string | null;
  error: string | null;
}

/** "Select a State" — Figma 886:1076/1106 (mobile) and 886:1136 (PC): radio rows + pinned Continue. */
export default function StateSelect({
  title,
  subtitle,
  search,
  rows,
  membersSuffix,
  onSelect,
  selectLabel,
  continueLabel,
  canContinue,
  onContinue,
  noResults,
  notAvailable,
  error,
}: StateSelectProps) {
  return (
    <div className="flex w-full flex-1 flex-col px-[18px] pb-[140px] lg:max-w-[887px] lg:px-0 lg:pb-0">
      <h1 className="pt-[33px] text-[32px] font-bold leading-[38px] text-mem-title lg:pt-[78px] lg:text-[48px] lg:leading-[46px]">
        {title}
      </h1>
      <p className="pt-[9px] text-[14px] font-medium leading-[16px] text-mem-subtitle lg:pt-[20px] lg:text-[24px] lg:leading-[29px]">
        {subtitle}
      </p>
      {notAvailable ? (
        <p className="pt-[28px] text-[15px] text-mem-muted lg:text-[20px]">{notAvailable}</p>
      ) : (
        <>
          <div className="pt-[20px] lg:pt-[37px]">
            <MembersSearch {...search} iconSize={26} />
          </div>
          <ul
            role="radiogroup"
            aria-label={title}
            className="flex flex-col gap-[8px] pt-[26px] lg:gap-[16px] lg:pt-[43px]"
          >
            {rows.map((r) => (
              <li key={r.state}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={r.selected}
                  aria-label={selectLabel(r.state)}
                  onClick={() => onSelect(r.state)}
                  className={`flex h-[46px] w-full items-center rounded-[9px] border bg-mem-row px-[16px] text-left lg:h-[64px] lg:rounded-[12px] lg:pl-[41px] lg:pr-[36px] ${
                    r.selected ? "border-kink-gold-bright" : "border-mem-row-border"
                  }`}
                >
                  <span className="truncate text-[20px] font-bold text-mem-text lg:text-[24px]">
                    {r.state}
                  </span>
                  <span className="ml-auto grid h-[18px] w-[101px] shrink-0 place-items-center rounded-[50px] border-[0.5px] border-mem-pill-border bg-mem-pill-bg text-[12px] font-semibold lg:h-[34px] lg:w-[161px] lg:text-[18px]">
                    <span>
                      <span className="text-mem-pill-text">{r.count} </span>
                      <span className="text-mem-pill-text-2">{membersSuffix}</span>
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className="ml-[19px] grid size-[18px] shrink-0 place-items-center rounded-full border-[3px] border-mem-radio lg:ml-[24px] lg:size-[24px]"
                  >
                    {r.selected && (
                      <span className="size-[8px] rounded-full bg-mem-radio lg:size-[10px]" />
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {noResults && (
            <p className="pt-[16px] text-[14px] text-mem-muted lg:text-[20px]">{noResults}</p>
          )}
          {error && <p className="pt-[16px] text-[14px] text-mem-muted lg:text-[20px]">{error}</p>}
          <button
            type="button"
            onClick={onContinue}
            disabled={!canContinue}
            className="fixed bottom-[calc(85px+env(safe-area-inset-bottom))] left-1/2 h-[55px] w-[366px] max-w-[calc(100vw-74px)] -translate-x-1/2 rounded-[100px] bg-kink-gold-bright text-[24px] font-bold text-black disabled:opacity-50 lg:static lg:mb-[61px] lg:mt-[40px] lg:w-[623px] lg:translate-x-0 lg:self-center lg:text-[32px]"
          >
            {continueLabel}
          </button>
        </>
      )}
    </div>
  );
}
