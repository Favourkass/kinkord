"use client";

import { Suspense } from "react";
import AuthShell from "@/components/auth/AuthShell";
import SearchSelectField from "@/components/auth/SearchSelectField";
import LocationCheckPanel from "@/components/location/LocationCheckPanel";
import { useMemberLocationCheckPresenter } from "@/presenters/useMemberLocationCheckPresenter";

// useSearchParams needs a Suspense boundary for the page to prerender.
export default function LocationCheckPage() {
  return (
    <Suspense fallback={null}>
      <LocationCheckScreen />
    </Suspense>
  );
}

/** Where members wait while their country check is due; outside the app shell, which they can't use yet. */
function LocationCheckScreen() {
  const p = useMemberLocationCheckPresenter();
  return (
    <AuthShell>
      {p.loading ? (
        <p className="mt-16 text-kink-dim">{p.loadingLabel}</p>
      ) : p.loadError ? (
        <p role="alert" className="mt-16 text-red-300">
          {p.loadError}
        </p>
      ) : (
        <LocationCheckPanel {...p.panel}>
          {p.choose && (
            <div className="flex w-full flex-col gap-4 text-left">
              <div className="text-center">
                <h2 className="text-[18px] font-bold text-kink-cream lg:text-[24px]">
                  {p.choose.title}
                </h2>
                <p className="mt-1 text-[14px] text-kink-mist lg:text-[16px]">{p.choose.body}</p>
              </div>
              <SearchSelectField
                label={p.choose.country.label}
                boldLabel
                value={p.choose.country.value}
                onChange={p.choose.country.onChange}
                options={p.choose.country.options}
                placeholder={p.choose.country.placeholder}
                searchPlaceholder={p.choose.country.searchPlaceholder}
                emptyLabel={p.choose.country.emptyLabel}
              />
              <SearchSelectField
                label={p.choose.state.label}
                boldLabel
                value={p.choose.state.value}
                onChange={p.choose.state.onChange}
                options={p.choose.state.options}
                resultLimit={p.choose.state.options.length}
                placeholder={p.choose.state.placeholder}
                searchPlaceholder={p.choose.state.searchPlaceholder}
                emptyLabel={p.choose.state.emptyLabel}
                disabled={p.choose.state.disabled}
              />
              {p.choose.hint && <p className="text-[13px] text-kink-dim">{p.choose.hint}</p>}
            </div>
          )}
          {p.saveError && (
            <p role="alert" className="text-[14px] text-red-300">
              {p.saveError}
            </p>
          )}
        </LocationCheckPanel>
      )}
    </AuthShell>
  );
}
