// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ComposerDialog, { type ComposerDialogProps } from "@/components/feed/ComposerDialog";
import { FEED_COPY, FEED_EDITOR, FEED_VISIBILITIES } from "@/constants/feed";
import { formattedBodyParts, type DraftSelection } from "@/domain/text-format";
import { formatPostDraft, insertPostText } from "@/services/post-editor.service";
afterEach(cleanup);
function show(over: Partial<ComposerDialogProps> = {}) {
  const submit = vi.fn(),
    close = vi.fn(),
    key = vi.fn(() => false),
    add = vi.fn();
  function Harness() {
    const [draft, setDraft] = useState("Hello there");
    const [selection, setSelection] = useState<(DraftSelection & { revision: number }) | null>(
      null,
    );
    const apply = (edit: ReturnType<typeof formatPostDraft>) => {
      if (!edit) return;
      setDraft(edit.text);
      setSelection((p) => ({ ...edit.selection, revision: (p?.revision ?? 0) + 1 }));
    };
    return (
      <ComposerDialog
        open
        autoPickPhoto={false}
        authorName="Demo member"
        avatarUrl={null}
        draft={draft}
        onDraftChange={setDraft}
        editor={{
          ...FEED_EDITOR,
          selection,
          previewParts: formattedBodyParts(draft, [], () => ""),
          onFormat: (format, at) => apply(formatPostDraft(draft, at, format, 2000)),
          onInsert: (text, at) => apply(insertPostText(draft, at, text, 2000)),
        }}
        mentions={{
          open: false,
          items: [],
          highlighted: 0,
          onPick: vi.fn(),
          onKey: key,
          caret: null,
        }}
        maxLength={2000}
        visibility="public"
        visibilities={FEED_VISIBILITIES}
        onVisibilityChange={vi.fn()}
        photos={[]}
        photoSlots={4}
        onAddPhotos={add}
        onRemovePhoto={vi.fn()}
        error={null}
        posting={false}
        canPost
        onSubmit={submit}
        onClose={close}
        labels={{
          title: FEED_COPY.composerTitle,
          submit: FEED_COPY.composerSubmit,
          posting: FEED_COPY.composerPosting,
          cancel: FEED_COPY.composerCancel,
          addPhoto: FEED_COPY.addPhotoShort,
          removePhoto: FEED_COPY.removePhoto,
          placeholder: FEED_COPY.composerPlaceholder,
          visibilityLabel: FEED_COPY.visibilityLabel,
          mentions: FEED_COPY.mentionSuggestions,
          organization: FEED_COPY.organization,
          verifiedOrganization: FEED_COPY.verifiedOrganization,
        }}
        {...over}
      />
    );
  }
  const view = render(<Harness />);
  return { ...view, submit, close, key, add };
}
it.each(["Bold", "Italic", "Underline"])(
  "formats selected text with the %s button and previews the rendered result",
  (format) => {
    show();
    const input = screen.getByRole("textbox", { name: "Post text" }) as HTMLTextAreaElement;
    input.setSelectionRange(0, 5);
    fireEvent.click(screen.getByRole("button", { name: format }));
    const marker = format === "Bold" ? "**" : format === "Italic" ? "*" : "__";
    expect(input.value).toBe(`${marker}Hello${marker} there`);
    fireEvent.click(screen.getByRole("button", { name: "Preview formatting" }));
    const tag = format === "Bold" ? "strong" : format === "Italic" ? "em" : "u";
    expect(screen.getByText("Hello").closest(tag)).toBeTruthy();
  },
);
it("inserts an emoji at the selected caret instead of replacing the whole draft", () => {
  show();
  const input = screen.getByRole("textbox") as HTMLTextAreaElement;
  input.setSelectionRange(5, 5);
  fireEvent.click(screen.getByRole("button", { name: "Add emoji" }));
  fireEvent.click(screen.getByRole("button", { name: "Fire" }));
  expect(input.value).toBe("Hello🔥 there");
  expect(input.selectionStart).toBe(7);
});
it("leaves Enter and Shift+Enter to the multiline editor, even while mentions are suggested", () => {
  const key = vi.fn(() => true);
  const { submit } = show({
    mentions: { open: true, items: [], highlighted: 0, onPick: vi.fn(), onKey: key, caret: null },
  });
  const input = screen.getByRole("textbox");
  for (const shiftKey of [false, true]) {
    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      shiftKey,
      bubbles: true,
      cancelable: true,
    });
    fireEvent(input, event);
    expect(event.defaultPrevented).toBe(false);
  }
  expect(key).not.toHaveBeenCalled();
  expect(submit).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "Line one\nLine two" } });
  expect((input as HTMLTextAreaElement).value).toBe("Line one\nLine two");
});
it("uploads chosen images and only posts through the Post button", () => {
  const { container, submit, add } = show();
  const photo = new File(["photo"], "test.png", { type: "image/png" });
  fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [photo] } });
  expect(add).toHaveBeenCalledWith([photo]);
  fireEvent.click(screen.getByRole("button", { name: "Post" }));
  expect(submit).toHaveBeenCalledOnce();
});
it("locks editing and closing while a post is being sent", () => {
  const { close } = show({ posting: true, canPost: false });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(close).not.toHaveBeenCalled();
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).readOnly).toBe(true);
  expect((screen.getByRole("button", { name: "Bold" }) as HTMLButtonElement).disabled).toBe(true);
});
