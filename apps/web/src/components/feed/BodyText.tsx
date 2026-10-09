import Link from "next/link";
import type { BodyPart } from "@/domain/mentions";

/** A post's or comment's words, with each @mention a link to that member. */
export default function BodyText({ parts }: { parts: BodyPart[] }) {
  return (
    <>
      {parts.map((part, i) =>
        "mention" in part ? (
          <Link
            key={i}
            href={part.href}
            className="font-semibold text-kink-gold-bright hover:underline"
          >
            {part.mention}
          </Link>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}
