// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { toPostVM, type PostPM } from "@/domain/post";
import PostCard from "./PostCard";

afterEach(cleanup);

const labels = {
  like: "Like",
  unlike: "Unlike",
  comment: "Comment",
  repost: "Repost",
  unrepost: "Undo repost",
  save: "Save",
  unsave: "Unsave",
  share: "Share",
  gift: "Gift",
  coin: "Coin",
  star: "Star",
  crown: "Crown",
  more: "More",
  less: "Less",
  menu: "Options",
  delete: "Delete",
  repostedBy: (name: string) => name,
  organization: "Org",
  verifiedOrganization: "Verified organization",
  follow: "Follow",
  following: "Following",
};

function show(silver: boolean, subscribed: boolean) {
  const pm: PostPM = {
    id: "p1",
    postId: "p1",
    body: "A post",
    visibility: "public",
    createdAt: new Date().toISOString(),
    author: {
      userId: "u2",
      username: "member",
      displayName: "Member",
      avatarUrl: null,
      silver,
      subscribed,
    },
    media: [],
    likes: 0,
    comments: 0,
    reposts: 0,
    likedByMe: false,
    repostedByMe: false,
    savedByMe: false,
    repostedBy: null,
    mine: false,
  };
  const action = vi.fn();
  return render(
    <PostCard
      post={toPostVM(pm, false, () => null)}
      labels={labels}
      menuOpen={false}
      onMenu={action}
      onCloseMenu={action}
      onDelete={action}
      onToggleBody={action}
      onLike={action}
      onRepost={action}
      onComment={action}
      onSave={action}
      onShare={action}
      onGift={action}
      onToggleAuthorFollow={action}
      onOpenMedia={action}
    />,
  );
}

describe("post Silver badge and gift eligibility", () => {
  it("allows gifts for a subscribed author without granting a withheld badge", () => {
    show(false, true);
    expect(screen.queryByRole("img", { name: "Silver Premium" })).toBeNull();
    expect(screen.getByRole("button", { name: "Gift (0)" })).toBeTruthy();
  });
  it("shows the badge only when the API's silver eligibility is true", () => {
    show(true, true);
    expect(screen.getByRole("img", { name: "Silver Premium" })).toBeTruthy();
  });
});

function menuOf(over: Partial<PostPM>) {
  const pm: PostPM = {
    id: "p1",
    postId: "p1",
    body: "A post",
    visibility: "public",
    createdAt: new Date().toISOString(),
    author: { userId: "u2", username: "member", displayName: "Member", avatarUrl: null },
    media: [],
    likes: 0,
    comments: 0,
    reposts: 0,
    likedByMe: false,
    repostedByMe: false,
    savedByMe: false,
    repostedBy: null,
    mine: false,
    ...over,
  };
  const on = { close: vi.fn(), repost: vi.fn(), save: vi.fn(), remove: vi.fn() };
  const noop = vi.fn();
  render(
    <PostCard
      post={toPostVM(pm, false, () => null)}
      labels={labels}
      menuOpen
      onMenu={noop}
      onCloseMenu={on.close}
      onDelete={on.remove}
      onToggleBody={noop}
      onLike={noop}
      onRepost={on.repost}
      onComment={noop}
      onSave={on.save}
      onShare={noop}
      onGift={noop}
      onToggleAuthorFollow={noop}
      onOpenMedia={noop}
    />,
  );
  return on;
}

describe("the post menu", () => {
  it("keeps repost and save on anyone's post, and closes once one is picked", () => {
    const on = menuOf({});
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(on.save).toHaveBeenCalledOnce();
    expect(on.close).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Repost" }));
    expect(on.repost).toHaveBeenCalledOnce();
  });
  it("offers unsave and undo once they're done", () => {
    menuOf({ savedByMe: true, repostedByMe: true });
    expect(screen.getByRole("button", { name: "Unsave" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Undo repost" })).toBeTruthy();
  });
  it("undoes your own repost once, not twice", () => {
    const on = menuOf({ id: "r1", mine: true, repostedByMe: true });
    const undo = screen.getAllByRole("button", { name: "Undo repost" });
    expect(undo).toHaveLength(1);
    fireEvent.click(undo[0]);
    expect(on.remove).toHaveBeenCalledOnce();
  });
});

describe("the like button", () => {
  it("looks pressed once liked, not only to a screen reader", () => {
    menuOf({ likedByMe: true });
    const liked = screen.getByRole("button", { name: "Unlike (0)" });
    expect(liked.getAttribute("aria-pressed")).toBe("true");
    expect(liked.className).toContain("bg-kink-gold-bright/20");
    cleanup();
    menuOf({});
    expect(screen.getByRole("button", { name: "Like (0)" }).className).not.toContain(
      "bg-kink-gold-bright/20",
    );
  });
});
