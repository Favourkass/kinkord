"use client";

import { useRef, type MouseEvent, type PointerEvent } from "react";
import { Ban, ChevronDown, Forward } from "lucide-react";
import MessageReceipt from "./MessageReceipt";
import type { ThreadMessageVM } from "@/domain/chat";

export interface MessageBubblePhotoLabels {
  alt: string;
  /** On a blurred photo: what a tap does. */
  reveal: string;
  open: string;
}

export interface MessageBubbleLabels {
  /** The arrow that opens a message's menu on a computer. */
  options: string;
  edited: string;
  forwarded: string;
  deletedOwn: string;
  deletedOther: string;
}

export interface MessageBubbleProps {
  message: ThreadMessageVM;
  retryLabel: string;
  onRetry?: (clientId: string) => void;
  photoLabels: MessageBubblePhotoLabels;
  labels: MessageBubbleLabels;
  onRevealPhoto?: (messageId: string) => void;
  onOpenPhoto?: (src: string) => void;
  /** A long press, a right-click or the arrow: the message's own menu. */
  onOpenActions?: (messageId: string) => void;
}

/** How long a finger rests on a message before its menu opens, as in other chat apps. */
const LONG_PRESS_MS = 450;
/** A finger that moves further than this is scrolling, not pressing. */
const PRESS_SLOP_PX = 10;

export default function MessageBubble({
  message,
  retryLabel,
  onRetry,
  photoLabels,
  labels,
  onRevealPhoto,
  onOpenPhoto,
  onOpenActions,
}: MessageBubbleProps) {
  const own = message.isOwn;
  const photo = message.photo;
  const actions = message.actionable && onOpenActions ? () => onOpenActions(message.id) : null;

  // A finger held still on the bubble opens its menu; the tap that ends the
  // press then does nothing else (no photo opens behind the menu).
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const pressed = useRef(false);
  const cancelPress = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pressStart.current = null;
  };
  const press = actions
    ? {
        onPointerDown: (e: PointerEvent) => {
          if (e.pointerType === "mouse") return;
          pressed.current = false;
          pressStart.current = { x: e.clientX, y: e.clientY };
          timer.current = setTimeout(() => {
            timer.current = null;
            pressed.current = true;
            actions();
          }, LONG_PRESS_MS);
        },
        onPointerMove: (e: PointerEvent) => {
          const start = pressStart.current;
          if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > PRESS_SLOP_PX) {
            cancelPress();
          }
        },
        onPointerUp: cancelPress,
        onPointerCancel: cancelPress,
        onPointerLeave: cancelPress,
        onContextMenu: (e: MouseEvent) => {
          e.preventDefault();
          cancelPress();
          actions();
        },
        onClickCapture: (e: MouseEvent) => {
          if (!pressed.current) return;
          pressed.current = false;
          e.preventDefault();
          e.stopPropagation();
        },
      }
    : {};

  return (
    <li className={`flex ${own ? "justify-end" : "justify-start"} px-[16px] py-[3px]`}>
      <div
        {...press}
        className={`group relative max-w-[85%] rounded-[9px] text-[15px] leading-[21px] shadow-sm after:absolute after:top-0 after:size-[9px] [@media(pointer:coarse)]:select-none [@media(pointer:coarse)]:[-webkit-touch-callout:none] ${
          photo ? "px-[4px] pb-[8px] pt-[4px]" : "px-[10px] py-[7px]"
        } ${
          own
            ? "rounded-tr-none bg-[#3b3019] text-[#fff8e7] after:-right-[7px] after:bg-[#3b3019] after:[clip-path:polygon(0_0,100%_0,0_100%)]"
            : "rounded-tl-none bg-[#1b1b1b] text-app-text after:-left-[7px] after:bg-[#1b1b1b] after:[clip-path:polygon(0_0,100%_0,100%_100%)]"
        }`}
      >
        {actions && (
          <button
            type="button"
            onClick={actions}
            aria-label={labels.options}
            aria-haspopup="menu"
            className="absolute right-[4px] top-[4px] z-10 grid size-[22px] place-items-center rounded-full bg-black/45 text-white/85 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 [@media(pointer:coarse)]:hidden"
          >
            <ChevronDown size={16} aria-hidden />
          </button>
        )}
        {message.forwarded && (
          <span
            className={`flex items-center gap-[4px] pb-[2px] text-[12px] italic text-white/55 ${photo ? "px-[6px] pt-[2px]" : ""}`}
          >
            <Forward size={13} aria-hidden />
            {labels.forwarded}
          </span>
        )}
        {photo && (
          <button
            type="button"
            onClick={() => {
              if (photo.hidden) onRevealPhoto?.(message.id);
              else if (photo.fullSrc) onOpenPhoto?.(photo.fullSrc);
            }}
            aria-label={photo.hidden ? photoLabels.reveal : photoLabels.open}
            className="relative block size-[220px] max-w-full overflow-hidden rounded-[12px] bg-black/20"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL, not optimizable */}
            <img
              src={photo.src}
              alt={photoLabels.alt}
              draggable={false}
              className={`size-full object-cover ${photo.hidden ? "scale-110 blur-[20px]" : ""}`}
            />
            {photo.hidden && (
              <span className="absolute inset-0 grid place-items-center">
                <span className="rounded-full bg-black/60 px-[12px] py-[6px] text-[12px] font-semibold text-white">
                  {photoLabels.reveal}
                </span>
              </span>
            )}
          </button>
        )}
        <div className={`flow-root ${photo ? "px-[6px] pt-[6px]" : ""}`}>
          {message.deleted ? (
            <span className="inline-flex items-center gap-[6px] italic text-white/55">
              <Ban size={14} aria-hidden />
              {own ? labels.deletedOwn : labels.deletedOther}
            </span>
          ) : (
            message.body && (
              <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{message.body}</span>
            )
          )}
          <span className="float-right ml-[10px] mt-[5px] inline-flex items-center gap-[4px] text-[11px] leading-[16px] text-white/55">
            {message.edited && <span>{labels.edited}</span>}
            {message.status === "sending" ? "sending…" : message.time}
            {own &&
              !message.deleted &&
              (message.status === "sent" ||
                message.status === "delivered" ||
                message.status === "seen") && <MessageReceipt status={message.status} />}
          </span>
        </div>
        {message.status === "failed" && (
          <button
            type="button"
            onClick={() => message.clientId && onRetry?.(message.clientId)}
            className={`pt-[4px] text-[11px] font-semibold text-app-danger ${photo ? "px-[10px]" : ""}`}
          >
            {retryLabel}
          </button>
        )}
      </div>
    </li>
  );
}
