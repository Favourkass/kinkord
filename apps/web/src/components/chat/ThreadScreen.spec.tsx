// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ThreadScreen, { type ThreadScreenProps } from "./ThreadScreen";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));
afterEach(cleanup);

const props: ThreadScreenProps = {
  peer: null,
  messages: [],
  dayGroups: [],
  loading: false,
  error: null,
  sendError: null,
  unavailable: false,
  unavailableText: "This member is no longer on Kinkord.",
  newChat: null,
  onlineLabel: "Online",
  organizationLabel: "Official",
  verifiedOrganizationLabel: "Official Kinkord account",
  backHref: "/messages",
  backLabel: "Back",
  emptyText: "Say hi",
  retryLabel: "Tap to retry",
  onSend: vi.fn(),
  onRetry: vi.fn(),
  composer: { placeholder: "Message…", sendLabel: "Send", maxLength: 4000 },
  photoNotice: null,
  photoLabels: { alt: "Photo", reveal: "Tap to view", open: "Open photo" },
  onRevealPhoto: vi.fn(),
  onOpenPhoto: vi.fn(),
  viewingPhoto: null,
  photoCloseLabel: "Close",
  onClosePhoto: vi.fn(),
  hasMore: false,
  loadingMore: false,
  loadMoreLabel: "Load earlier messages",
  onLoadMore: vi.fn(),
  menu: null,
  blocked: null,
  blockDialog: null,
  report: null,
  safetyError: null,
};

it("shows a notice's link in place of the composer", () => {
  render(
    <ThreadScreen
      {...props}
      newChat={{
        text: "Messaging members in another country is part of Silver Premium.",
        blocking: true,
        link: { label: "Get Silver Premium", href: "/subscription" },
      }}
    />,
  );
  expect(screen.getByText(/part of Silver Premium/)).toBeTruthy();
  expect(screen.getByRole("link", { name: "Get Silver Premium" }).getAttribute("href")).toBe(
    "/subscription",
  );
  expect(screen.queryByPlaceholderText("Message…")).toBeNull();
});

it("keeps the composer under a hint, with no link", () => {
  render(<ThreadScreen {...props} newChat={{ text: "One new chat a day.", blocking: false }} />);
  expect(screen.getByText("One new chat a day.")).toBeTruthy();
  expect(screen.getByPlaceholderText("Message…")).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Get Silver Premium" })).toBeNull();
});
