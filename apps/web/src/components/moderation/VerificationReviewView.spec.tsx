// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdminVerificationReviewVM } from "@/domain/moderation";
import VerificationReviewView, { type VerificationReviewViewProps } from "./VerificationReviewView";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));

const row = (over: Partial<AdminVerificationReviewVM> = {}): AdminVerificationReviewVM => ({
  id: "v1",
  name: "Ada",
  handle: "@ada",
  memberHref: "/moderation/members/u2",
  when: "an hour ago",
  reasons: ["Unclear photo match"],
  checks: [],
  photoUrl: "https://media/a_md.jpg?X-Amz-Signature=s1",
  originalPhotoUrl: "https://media/a.jpg?X-Amz-Signature=s2",
  sessionId: "session-1",
  canApprove: true,
  cannotApprove: null,
  locked: null,
  duplicate: null,
  ...over,
});

const props = (over: Partial<VerificationReviewViewProps> = {}): VerificationReviewViewProps => ({
  loading: false,
  error: null,
  empty: false,
  rows: [row()],
  notice: null,
  dialog: null,
  stepUp: null,
  confirmedUntil: "Confirmed until 10:10",
  onApprove: vi.fn(),
  onReject: vi.fn(),
  onRefresh: vi.fn(),
  labels: {
    intro: "Intro",
    loading: "Loading",
    empty: "Empty",
    refresh: "Refresh",
    openMember: "Open member",
    photo: "Profile photo",
    original: "Original upload",
    closePhoto: "Close photo",
    session: "Didit session",
    why: "Why",
    checksHeading: "Checks",
    passed: "Passed",
    notPassed: "Not passed",
    approve: "Approve",
    reject: "Reject",
  },
  ...over,
});

describe("VerificationReviewView", () => {
  afterEach(cleanup);

  it("enlarges a photo in the page instead of opening its signed link in a tab", () => {
    const { container } = render(<VerificationReviewView {...props()} />);
    expect(container.querySelector('a[target="_blank"]')).toBeNull();
    expect(container.querySelector('a[href*="X-Amz-Signature"]')).toBeNull();
    const thumbs = screen.getAllByRole("img");
    expect(thumbs.map((img) => img.getAttribute("loading"))).toEqual(["lazy", "lazy"]);

    fireEvent.click(screen.getByRole("button", { name: "Profile photo: Ada" }));
    const viewer = screen.getByRole("dialog", { name: "Profile photo: Ada" });
    expect(within(viewer).getByRole("img").getAttribute("src")).toBe(row().photoUrl);
    expect(document.activeElement).toBe(
      within(viewer).getByRole("button", { name: "Close photo" }),
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows why there's no decision on a locked review, and links a duplicate account", () => {
    render(
      <VerificationReviewView
        {...props({
          rows: [
            row({
              locked: "Only a founder can decide an admin's verification.",
              duplicate: { label: "Same ID as @twin", href: "/moderation/members/u7" },
            }),
          ],
        })}
      />,
    );
    expect(screen.getByText("Only a founder can decide an admin's verification.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reject" })).toBeNull();
    expect(screen.getByRole("link", { name: "Same ID as @twin" }).getAttribute("href")).toBe(
      "/moderation/members/u7",
    );
  });

  it("asks for the code with the way to turn on two-factor, and no length cap on paste", () => {
    render(
      <VerificationReviewView
        {...props({
          stepUp: {
            title: "Confirm",
            body: "Enter the code.",
            label: "Authenticator code",
            action: "Confirm",
            code: "",
            setCode: vi.fn(),
            submit: vi.fn(),
            canSubmit: false,
            busy: false,
            error: "Your two-factor confirmation ran out. Enter a new code.",
            hint: "No authenticator app yet?",
            security: { label: "Security settings", href: "/settings/security" },
          },
        })}
      />,
    );
    const code = screen.getByLabelText("Authenticator code");
    expect(code.hasAttribute("maxlength")).toBe(false);
    expect(code.getAttribute("inputmode")).toBe("numeric");
    expect(screen.getByRole("alert").textContent).toMatch(/ran out/);
    expect(screen.getByRole("link", { name: "Security settings" }).getAttribute("href")).toBe(
      "/settings/security",
    );
    // The queue stays out of sight until the session is confirmed again.
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });
});
