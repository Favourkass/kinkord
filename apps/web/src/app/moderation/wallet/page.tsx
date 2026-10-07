"use client";
import ModerationFrame from "@/components/moderation/ModerationFrame";
import WalletAdminView from "@/components/kinkcoins/WalletAdminView";
import { MODERATION_COPY } from "@/constants/moderation";
import { useWalletAdminPresenter } from "@/presenters/useWalletAdminPresenter";
import { moderationTabs } from "../tabs";
export default function Page() {
  const vm = useWalletAdminPresenter();
  return (
    <ModerationFrame
      title={vm.copy.adminTitle}
      tabs={moderationTabs("wallet")}
      checking={vm.checking}
      isAdmin={vm.isAdmin}
      checkingLabel={MODERATION_COPY.checking}
      deniedLabel={MODERATION_COPY.denied}
    >
      <WalletAdminView vm={vm} />
    </ModerationFrame>
  );
}
