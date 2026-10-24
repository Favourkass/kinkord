import { Check, CheckCheck } from "lucide-react";
import type { MessageReceiptStatus } from "@/domain/chat";

export interface MessageReceiptProps {
  status: MessageReceiptStatus;
}

export default function MessageReceipt({ status }: MessageReceiptProps) {
  const Icon = status === "sent" ? Check : CheckCheck;
  const label = status === "seen" ? "Seen" : status === "delivered" ? "Delivered" : "Sent";
  const color =
    status === "seen"
      ? "text-green-400"
      : status === "delivered"
        ? "text-yellow-400"
        : "text-white";
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center align-middle ${color}`}
    >
      <Icon size={17} strokeWidth={2.6} aria-hidden="true" />
    </span>
  );
}
