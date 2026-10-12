// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ChatListScreen, { type ChatListScreenProps } from "./ChatListScreen";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));
afterEach(cleanup);
const props: ChatListScreenProps = {
  rows: [
    {
      id: "a",
      href: "/messages/a",
      displayName: "Ada",
      silver: false,
      avatarUrl: null,
      preview: "Hello",
      time: "10:00",
      unread: 12,
      isOnline: true,
    },
  ],
  heading: "Messages",
  loading: false,
  error: null,
  empty: false,
  loadingText: "Loading",
  emptyTitle: "Empty",
  emptyBody: "No chats",
  onlineLabel: "Online",
  query: "",
  onQuery: vi.fn(),
  searchMaxLength: 100,
  filters: [
    { key: "all", label: "All", count: "1", active: true },
    { key: "unread", label: "Unread", count: "1", active: false },
  ],
  onFilter: vi.fn(),
  menuOpen: false,
  onToggleMenu: vi.fn(),
  onCloseMenu: vi.fn(),
  onNavigation: vi.fn(),
  newChatHref: "/search",
  settingsHref: "/settings",
  copy: {
    search: "Search chats…",
    searchLabel: "Search chats",
    clear: "Clear search",
    filtersLabel: "Filters",
    menu: "More options",
    navigation: "Open menu",
    newChat: "New message",
    settings: "Settings",
    sent: "Sent",
    unread: "unread messages",
  },
};
it("renders unread counts and passes search and filter interactions to the screen", () => {
  render(<ChatListScreen {...props} />);
  expect(screen.getByLabelText("12 unread messages").textContent).toBe("12");
  expect(screen.getByRole("link", { name: /Ada/ }).getAttribute("href")).toBe("/messages/a");
  expect(screen.getByRole("searchbox").getAttribute("maxlength")).toBe("100");
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Ada" } });
  expect(props.onQuery).toHaveBeenCalledWith("Ada");
  fireEvent.click(screen.getByRole("button", { name: "Unread 1" }));
  expect(props.onFilter).toHaveBeenCalledWith("unread");
});
it("offers working navigation actions in the overflow menu", () => {
  render(<ChatListScreen {...props} menuOpen />);
  expect(screen.getByRole("link", { name: "New message" }).getAttribute("href")).toBe("/search");
  fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
  expect(props.onNavigation).toHaveBeenCalled();
});

it("keeps the menu open for a tap inside it, though the shell mounts the screen twice", () => {
  const onCloseMenu = vi.fn();
  render(
    <>
      <ChatListScreen {...props} menuOpen onCloseMenu={onCloseMenu} />
      <div hidden>
        <ChatListScreen {...props} menuOpen onCloseMenu={onCloseMenu} />
      </div>
    </>,
  );
  fireEvent.pointerDown(screen.getAllByRole("link", { name: "New message" })[0]);
  expect(onCloseMenu).not.toHaveBeenCalled();
});
it("closes the menu on a tap outside it or Escape, but not on a tap inside", () => {
  const onCloseMenu = vi.fn();
  render(<ChatListScreen {...props} menuOpen onCloseMenu={onCloseMenu} />);
  fireEvent.pointerDown(screen.getByRole("link", { name: "New message" }));
  expect(onCloseMenu).not.toHaveBeenCalled();
  fireEvent.pointerDown(document.body);
  expect(onCloseMenu).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onCloseMenu).toHaveBeenCalledTimes(2);
});

it("shows the Silver badge, presence and typing", () => {
  render(
    <ChatListScreen
      {...props}
      rows={[
        {
          ...props.rows[0],
          silver: true,
          typing: true,
          preview: "Is typing…",
          presence: "away",
          presenceLabel: "Away",
        },
      ]}
    />,
  );
  expect(screen.getByRole("img", { name: "Silver Premium" })).toBeDefined();
  expect(screen.getByRole("img", { name: "Away" })).toBeDefined();
  expect(screen.getByText("Is typing…")).toBeDefined();
});
