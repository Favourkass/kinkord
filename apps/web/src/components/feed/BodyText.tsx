import Link from "next/link";
import type { BodyPart } from "@/domain/mentions";
import type { ReactNode } from "react";

/** Safe display-ready formatting and verified mentions, never injected HTML. */
export default function BodyText({ parts }: { parts: BodyPart[] }) {
  return (
    <>
      {parts.map((part, i) => {
        let content: ReactNode =
          "mention" in part ? (
            <Link href={part.href} className="font-semibold text-kink-gold-bright hover:underline">
              {part.mention}
            </Link>
          ) : (
            part.text
          );
        if (part.marks?.bold) content = <strong className="font-bold">{content}</strong>;
        if (part.marks?.italic) content = <em>{content}</em>;
        if (part.marks?.underline)
          content = <u className="underline underline-offset-2">{content}</u>;
        return <span key={i}>{content}</span>;
      })}
    </>
  );
}
