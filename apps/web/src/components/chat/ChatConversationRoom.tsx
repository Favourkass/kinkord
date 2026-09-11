import type { ConversationVM, MessageVM } from "@/domain/chat";
import ChatInputBar from "./ChatInputBar";
import ChatMessageTimeline from "./ChatMessageTimeline";
import ChatNoticeBanners from "./ChatNoticeBanners";
import ChatRoomHeader from "./ChatRoomHeader";

export interface ChatConversationRoomProps {
  conversation: ConversationVM;
  messages: MessageVM[];
  onBack: () => void;
  onMoreClick?: () => void;
  draft: string;
  onDraftChange: (text: string) => void;
  onSend: () => void;
  replyingTo?: MessageVM | null;
  onReply?: (message: MessageVM) => void;
  onCancelReply?: () => void;
  encryptionNoticeVisible?: boolean;
  onLearnMoreEncryption?: () => void;
  disappearingNoticeVisible?: boolean;
  onChangeDisappearing?: () => void;
}

export default function ChatConversationRoom({
  conversation,
  messages,
  onBack,
  onMoreClick,
  draft,
  onDraftChange,
  onSend,
  replyingTo,
  onReply,
  onCancelReply,
  encryptionNoticeVisible = true,
  onLearnMoreEncryption,
  disappearingNoticeVisible = true,
  onChangeDisappearing,
}: ChatConversationRoomProps) {
  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col bg-black text-white">
      {/* Room Header */}
      <ChatRoomHeader
        conversation={conversation}
        onBack={onBack}
        onMoreClick={onMoreClick}
      />

      {/* Security & Disappearing Notice Banners */}
      <ChatNoticeBanners
        encryptionVisible={encryptionNoticeVisible}
        onLearnMoreEncryption={onLearnMoreEncryption}
        disappearingVisible={disappearingNoticeVisible}
        onChangeDisappearing={onChangeDisappearing}
      />

      {/* Timeline Stream */}
      <ChatMessageTimeline messages={messages} onReply={onReply} />

      {/* Bottom Input Pill */}
      <ChatInputBar
        draft={draft}
        onDraftChange={onDraftChange}
        onSend={onSend}
        replyingTo={replyingTo}
        onCancelReply={onCancelReply}
      />
    </div>
  );
}
