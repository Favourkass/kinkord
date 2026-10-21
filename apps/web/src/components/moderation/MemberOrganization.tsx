export interface MemberOrganizationProps {
  organization: boolean;
  /** The country it speaks for, by name; null for a person's account. */
  countryName: string | null;
  /** Founders only; other admins see which kind of account it is. */
  canChange: boolean;
  choices: readonly { value: string; label: string }[];
  selected: string;
  setSelected: (value: string) => void;
  onToggle: () => void;
  labels: {
    title: string;
    body: string;
    person: string;
    organization: (country: string) => string;
    country: string;
    choose: string;
    make: string;
    remove: string;
    foundersOnly: string;
  };
}

/** Admin → member: whether the account is an organization's, and the founders' switch for it. */
export default function MemberOrganization(p: MemberOrganizationProps) {
  return (
    <section className="mt-[12px] rounded-[16px] border border-app-card-border bg-app-card p-[14px]">
      <h2 className="text-[15px] font-bold text-kink-amber">{p.labels.title}</h2>
      <p className="mt-2 text-[13px] text-app-subtle">{p.labels.body}</p>
      <p className="mt-2 text-[14px] text-app-value">
        {p.organization ? p.labels.organization(p.countryName ?? "") : p.labels.person}
      </p>
      {p.canChange ? (
        <div className="mt-3 flex flex-col gap-[10px] md:flex-row md:items-end">
          {!p.organization ? (
            <label className="flex-1 text-[13px] font-bold text-app-text">
              {p.labels.country}
              <select
                value={p.selected}
                onChange={(e) => p.setSelected(e.target.value)}
                className="mt-[6px] h-[42px] w-full rounded-[12px] border border-app-input-border bg-app-input px-[12px] text-[15px] font-normal text-app-value focus:border-kink-amber focus:outline-none"
              >
                <option value="">{p.labels.choose}</option>
                {p.choices.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            type="button"
            onClick={p.onToggle}
            className="rounded-xl border border-kink-amber px-4 py-2 font-bold text-kink-amber"
          >
            {p.organization ? p.labels.remove : p.labels.make}
          </button>
        </div>
      ) : (
        <p className="mt-2 text-[12px] text-app-subtle">{p.labels.foundersOnly}</p>
      )}
    </section>
  );
}
