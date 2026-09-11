"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { MessageSquare, Plus } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import ChatConversationList from "@/components/chat/ChatConversationList";
import ChatConversationRoom from "@/components/chat/ChatConversationRoom";
import NewChatModal from "@/components/chat/NewChatModal";
import { getAppShellNav } from "@/presenters/getAppShellNav";
import { useChatPresenter } from "@/presenters/useChatPresenter";
import { useHomePresenter } from "@/presenters/useHomePresenter";

function MessagesContent() {
  const searchParams = useSearchParams();
  const initialConvId = searchParams.get("c");
  const initialUsername = searchParams.get("u");

  const homeVm = useHomePresenter();
  const nav = getAppShellNav();
  const chatVm = useChatPresenter({
    initialConversationId: initialConvId,
    initialUsername: initialUsername,
  });

  const isRoomActiveOnMobile = Boolean(chatVm.activeConversation);

  return (
    <AppShell
      brand="KINKORD"
      tagline="THE WORLD'S KINK COMMUNITY"
      greeting={homeVm.greeting}
      name={homeVm.name}
      handle={homeVm.handle}
      avatarUrl={homeVm.avatarUrl}
      membersCount={homeVm.membersCount}
      activeTab="chat"
      activeNav="chat"
      drawerOpen={homeVm.drawerOpen}
      onMenu={homeVm.openDrawer}
      onCloseDrawer={homeVm.closeDrawer}
      onLogout={homeVm.logout}
      links={nav.links}
      labels={nav.labels}
      desktopGreeting={false}
      hideMobileHeader={true}
      hideMobileTabBar={isRoomActiveOnMobile}
    >
      <div className="flex h-[calc(100dvh-57px-env(safe-area-inset-bottom))] lg:h-dvh w-full flex-col bg-black">
        {/* Mobile View: Toggles between List and Room */}
        <div className="flex h-full w-full flex-col lg:hidden">
          {chatVm.activeConversation ? (
            <ChatConversationRoom
              conversation={chatVm.activeConversation}
              messages={chatVm.messages}
              onBack={chatVm.clearActiveConversation}
              draft={chatVm.messageDraft}
              onDraftChange={chatVm.setMessageDraft}
              onSend={chatVm.sendMessage}
              replyingTo={chatVm.replyingTo}
              onReply={chatVm.setReplyingTo}
              onCancelReply={chatVm.cancelReply}
              encryptionNoticeVisible={chatVm.encryptionNoticeVisible}
              disappearingNoticeVisible={chatVm.disappearingNoticeVisible}
              onLearnMoreEncryption={() => {}}
              onChangeDisappearing={() => {}}
            />
          ) : (
            <ChatConversationList
              conversations={chatVm.conversations}
              selectedId={chatVm.activeConversationId}
              onSelect={chatVm.selectConversation}
              searchQuery={chatVm.searchQuery}
              onSearchChange={chatVm.setSearchQuery}
              activeFilter={chatVm.filter}
              onFilterChange={chatVm.setFilter}
              onComposeClick={chatVm.openNewChat}
            />
          )}
        </div>

        {/* Desktop View: Dual Split-Pane */}
        <div className="hidden h-full w-full lg:flex">
          {/* Left Column: Conversation List */}
          <div className="flex h-full w-[380px] shrink-0 flex-col border-r border-white/10">
            <ChatConversationList
              conversations={chatVm.conversations}
              selectedId={chatVm.activeConversationId}
              onSelect={chatVm.selectConversation}
              searchQuery={chatVm.searchQuery}
              onSearchChange={chatVm.setSearchQuery}
              activeFilter={chatVm.filter}
              onFilterChange={chatVm.setFilter}
              onComposeClick={chatVm.openNewChat}
            />
          </div>

          {/* Right Column: Active Room or Empty State */}
          <div className="flex h-full min-w-0 flex-1 flex-col bg-black">
            {chatVm.activeConversation ? (
              <ChatConversationRoom
                conversation={chatVm.activeConversation}
                messages={chatVm.messages}
                onBack={chatVm.clearActiveConversation}
                draft={chatVm.messageDraft}
                onDraftChange={chatVm.setMessageDraft}
                onSend={chatVm.sendMessage}
                replyingTo={chatVm.replyingTo}
                onReply={chatVm.setReplyingTo}
                onCancelReply={chatVm.cancelReply}
                encryptionNoticeVisible={chatVm.encryptionNoticeVisible}
                disappearingNoticeVisible={chatVm.disappearingNoticeVisible}
                onLearnMoreEncryption={() => {}}
                onChangeDisappearing={() => {}}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center text-[#8e8e93]">
                <div className="grid size-20 place-items-center rounded-3xl bg-[#141417] text-kink-gold-bright border border-white/5 shadow-inner">
                  <MessageSquare className="size-10" />
                </div>
                <h3 className="mt-5 text-[20px] font-bold text-white">Your Messages</h3>
                <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-[#8e8e93]">
                  Select a conversation from the list to start chatting, or start a new
                  private conversation.
                </p>
                <button
                  type="button"
                  onClick={chatVm.openNewChat}
                  className="mt-6 flex items-center gap-2 rounded-2xl bg-kink-gold-bright px-5 py-2.5 text-[14px] font-bold text-black hover:brightness-110 active:scale-95 transition shadow-md shadow-kink-gold-bright/10"
                >
                  <Plus className="size-4" />
                  <span>Start New Chat</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* New Chat / Compose Modal */}
        <NewChatModal
          isOpen={chatVm.newChatModalOpen}
          onClose={chatVm.closeNewChat}
          onSelectMember={chatVm.startChatWith}
        />
      </div>
    </AppShell>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-black" />}>
      <MessagesContent />
    </Suspense>
  );
}
