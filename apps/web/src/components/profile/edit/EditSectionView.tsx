import EditRowsCard, { type EditRowItem } from "./EditRowsCard";
import FieldEditorSheet, { type FieldEditorSheetProps } from "./FieldEditorSheet";

export interface EditSectionViewProps {
  heading: string;
  subtitle: string;
  variant: "list" | "cards";
  rows: EditRowItem[];
  notice: string | null;
  error: string | null;
  editor: FieldEditorSheetProps | null;
}

/** One Edit Profile section (Figma 1542:301 / 1641:642 / 1642:36): heading, rows, editor sheet. */
export default function EditSectionView(p: EditSectionViewProps) {
  return (
    <div className="flex w-full flex-col items-center gap-[24px]">
      <div className="flex flex-col gap-[8px] text-center text-[12px] text-pf-muted">
        <p className="font-bold">{p.heading}</p>
        <p className="italic">{p.subtitle}</p>
      </div>
      <EditRowsCard rows={p.rows} variant={p.variant} />
      {p.notice ? (
        <p className="text-[13px] font-semibold text-kink-gold-bright">{p.notice}</p>
      ) : null}
      {p.error ? <p className="text-[13px] font-semibold text-red-500">{p.error}</p> : null}
      {p.editor ? <FieldEditorSheet {...p.editor} /> : null}
    </div>
  );
}
