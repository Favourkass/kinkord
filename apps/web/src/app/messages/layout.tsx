"use client";

import ChatRulesGate from "@/components/chat/ChatRulesGate";
import { useChatRulesPresenter } from "@/presenters/useChatRulesPresenter";

/**
 * One place for the messaging rule gate. Putting it here rather than in each
 * page means a member who lands directly on `/messages/<id>` from a shared
 * link still has to acknowledge before they can read or send anything.
 */
export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  const rules = useChatRulesPresenter();

  return (
    <>
      {children}
      {rules.visible && (
        <ChatRulesGate
          badge={rules.copy.badge}
          title={rules.copy.title}
          intro={rules.copy.intro}
          sections={rules.copy.sections}
          report={rules.copy.report}
          closing={rules.copy.closing}
          acknowledgeLabel={rules.copy.acknowledgeLabel}
          neverLabel={rules.copy.neverLabel}
          neverShow={rules.neverShow}
          onNeverShowChange={rules.setNeverShow}
          onAcknowledge={rules.acknowledge}
        />
      )}
    </>
  );
}
