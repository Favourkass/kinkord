import type { ReactNode } from "react";
import AppShell, { type AppShellProps } from "@/components/app/AppShell";
import EditNavBar from "./EditNavBar";

export interface EditScreenProps {
  shell: Omit<
    AppShellProps,
    "children" | "mobileHeader" | "activeTab" | "activeNav" | "desktopGreeting"
  >;
  title: string;
  backLabel: string;
  onBack: () => void;
  loading: boolean;
  loadingLabel: string;
  error: string | null;
  children: ReactNode;
}

/** Chrome shared by every Edit Profile screen: back-arrow NavBar on mobile and desktop, avatar tab active. */
export default function EditScreen(p: EditScreenProps) {
  return (
    <AppShell
      {...p.shell}
      activeTab="profile"
      activeNav="edit-profile"
      desktopGreeting={false}
      mobileHeader={<EditNavBar title={p.title} backLabel={p.backLabel} onBack={p.onBack} />}
    >
      <EditNavBar
        title={p.title}
        backLabel={p.backLabel}
        onBack={p.onBack}
        className="hidden lg:-mx-[30px] lg:flex"
      />
      <div className="mx-auto w-full max-w-[440px] px-[14px] pb-[32px] pt-[16px] lg:max-w-[560px] lg:pt-[24px]">
        {p.loading ? (
          <p className="text-center text-[14px] text-pf-muted">{p.loadingLabel}</p>
        ) : (
          p.children
        )}
        {!p.loading && p.error ? (
          <p className="pt-[12px] text-center text-[13px] font-semibold text-red-500">{p.error}</p>
        ) : null}
      </div>
    </AppShell>
  );
}
