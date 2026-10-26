// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import type { FeedEmptyVM, FeedTabVM, PostVM } from "@/domain/post";
import FeedScreen, { type FeedScreenProps } from "./FeedScreen";

// The screen's own job is the arrangement: the chrome, the dialogs and the
// cards are tested on their own.
vi.mock("./FeedShell", () => ({
  default: ({ aside, children }: { aside: ReactNode; children: ReactNode }) => (
    <div>
      <aside data-testid="rail">{aside}</aside>
      <main>{children}</main>
    </div>
  ),
}));
vi.mock("./PostCard", () => ({
  default: ({
    post,
    onNotInterested,
    onSeen,
  }: {
    post: PostVM;
    onNotInterested?: () => void;
    onSeen?: () => void;
  }) => (
    <article>
      {post.id}
      {onNotInterested && <button onClick={onNotInterested}>{`not interested ${post.id}`}</button>}
      {onSeen && <button onClick={onSeen}>{`seen ${post.id}`}</button>}
    </article>
  ),
}));
vi.mock("./KinkstersNearYou", () => ({
  default: ({ layout = "row" }: { layout?: string }) => (
    <section data-testid={`people-${layout}`} />
  ),
}));
vi.mock("./ComposerBar", () => ({ default: () => null }));
vi.mock("./ComposerDialog", () => ({ default: () => null }));
vi.mock("./CommentsPanel", () => ({ default: () => null }));
vi.mock("./MediaLightbox", () => ({ default: () => null }));
vi.mock("./ConfirmDialog", () => ({ default: () => null }));
vi.mock("./Toast", () => ({ default: () => null }));
vi.mock("./GiftDialog", () => ({ default: () => null }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const tabs = (selected: string): FeedTabVM[] =>
  (["for_you", "following", "nearby"] as const).map((value) => ({
    value,
    label: value,
    selected: value === selected,
  }));

const quiet: FeedEmptyVM = { title: "Nothing near you yet.", body: null, action: null };

function show(over: Partial<FeedScreenProps> = {}) {
  const props = {
    shell: {},
    tabs: { label: "Home feed", tabs: tabs("for_you"), onSelect: vi.fn() },
    loading: false,
    error: null,
    posts: [],
    postLabels: {},
    menuFor: null,
    hasMore: false,
    loadingMore: false,
    people: { heading: "Kinksters Near You" },
    empty: quiet,
    copy: { loading: "Loading…", loadMore: "Load more", asideHeading: "Kinkord", asideTagline: "" },
    ...over,
  } as unknown as FeedScreenProps;
  return { ...render(<FeedScreen {...props} />), props };
}

describe("FeedScreen", () => {
  it("puts the tabs over the list they control", () => {
    show({ tabs: { label: "Home feed", tabs: tabs("nearby"), onSelect: vi.fn() } });
    const panel = screen.getByRole("tabpanel");
    expect(panel.getAttribute("aria-labelledby")).toBe("feed-tab-nearby");
    expect(screen.getByRole("tab", { name: "nearby" }).getAttribute("aria-controls")).toBe(
      panel.id,
    );
  });

  it("shows Kinksters Near You in the phone feed and the desktop rail, or in neither", () => {
    show({ posts: [{ id: "p1" }, { id: "p2" }] as PostVM[] });
    expect(screen.getByTestId("people-row")).toBeTruthy();
    expect(within(screen.getByTestId("rail")).getByTestId("people-column")).toBeTruthy();
    cleanup();

    show({ people: null, posts: [{ id: "p1" }, { id: "p2" }] as PostVM[] });
    expect(screen.queryByTestId("people-row")).toBeNull();
    expect(screen.queryByTestId("people-column")).toBeNull();
    expect(screen.getAllByRole("article").map((a) => a.textContent)).toEqual(["p1", "p2"]);
  });

  it("says why a tab is empty, with a link to what would fill it", () => {
    show({
      empty: {
        title: "You're not following anyone yet",
        body: "Follow kinksters to see their posts here.",
        action: { label: "Browse kinksters", href: "/members" },
      },
    });
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByText("You're not following anyone yet")).toBeTruthy();
    expect(within(panel).getByText("Follow kinksters to see their posts here.")).toBeTruthy();
    expect(within(panel).getByRole("link", { name: "Browse kinksters" }).getAttribute("href")).toBe(
      "/members",
    );
  });

  it("hands Not interested and seen the post a card shows, a repost's original", () => {
    const onNotInterested = vi.fn();
    const onSeen = vi.fn();
    show({
      posts: [{ id: "r1", postId: "p1" } as PostVM],
      onNotInterested,
      onSeen,
      people: null,
    });
    act(() => screen.getByRole("button", { name: "not interested r1" }).click());
    act(() => screen.getByRole("button", { name: "seen r1" }).click());
    expect(onNotInterested).toHaveBeenCalledWith("p1");
    expect(onSeen).toHaveBeenCalledWith("p1");
    cleanup();
    show({ posts: [{ id: "r1", postId: "p1" } as PostVM], people: null });
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps a quiet tab to one line, and says nothing of emptiness while loading", () => {
    show();
    expect(screen.getByText("Nothing near you yet.")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
    cleanup();

    show({ loading: true });
    expect(screen.getByText("Loading…")).toBeTruthy();
    expect(screen.queryByText("Nothing near you yet.")).toBeNull();
  });
});

it("automatically loads near the bottom, pauses during loading, and stops at the end", () => {
  const callbacks: IntersectionObserverCallback[] = [];
  const disconnect = vi.fn();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        callbacks.push(callback);
      }
      observe = vi.fn();
      disconnect = disconnect;
    },
  );
  const onLoadMore = vi.fn();
  const { rerender, props } = show({ hasMore: true, onLoadMore });
  const intersect = () =>
    act(() =>
      callbacks.at(-1)!(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
  expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  intersect();
  intersect();
  expect(onLoadMore).toHaveBeenCalledTimes(1);
  rerender(<FeedScreen {...props} loadingMore />);
  expect(disconnect).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Loading…")).toBeTruthy();
  intersect();
  expect(onLoadMore).toHaveBeenCalledTimes(1);
  rerender(<FeedScreen {...props} loadingMore={false} />);
  intersect();
  expect(onLoadMore).toHaveBeenCalledTimes(2);
  rerender(<FeedScreen {...props} hasMore={false} />);
  expect(disconnect).toHaveBeenCalledTimes(2);
});

it("does not automatically retry pagination errors or load an old tab while switching", () => {
  const observe = vi.fn();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = observe;
      disconnect = vi.fn();
    },
  );
  const { rerender, props } = show({ hasMore: true, error: "Please refresh to try again." });
  expect(observe).not.toHaveBeenCalled();
  rerender(<FeedScreen {...props} error={null} loading />);
  expect(observe).not.toHaveBeenCalled();
});
