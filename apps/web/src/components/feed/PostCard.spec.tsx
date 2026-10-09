// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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
