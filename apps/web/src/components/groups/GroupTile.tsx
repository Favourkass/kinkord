import { Layers } from "lucide-react";

/** A group's square tile (Figma's profile card row): gold-bordered, a stacked-layers mark. */
export default function GroupTile({ size = 44 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-[10px] border border-kink-gold-bright/70 bg-app-card text-kink-gold-bright"
      style={{ width: size, height: size }}
    >
      <Layers size={Math.round(size * 0.48)} />
    </span>
  );
}
