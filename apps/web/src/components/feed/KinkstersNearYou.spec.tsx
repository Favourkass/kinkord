// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { FeedSuggestionVM, SuggestionSegmentVM } from "@/domain/post";
import KinkstersNearYou, { type KinkstersNearYouProps } from "./KinkstersNearYou";

afterEach(cleanup);

const labels = {
  follow: "Follow",
  following: "Following",
  remove: "Remove",
  online: "Online",
  lookingFor: "Looking for",
  loading: "Loading…",
  empty: "No one to suggest here yet.",
  organization: "Official",
  verifiedOrganization: "Official Kinkord account",
};

const card = (over: Partial<FeedSuggestionVM> = {}): FeedSuggestionVM => ({
  userId: "u1",
  displayName: "Lily Rose",
  silver: false,
  organization: false,
  avatarUrl: null,
  online: false,
  details: "26F • Lagos, Lagos State, Nigeria",
  roles: "Submissive, Switch, Brat",
  lookingFor: "Friendship, Events",
  reason: null,
  isFollowing: false,
  busy: false,
  href: "/u/lily",
  ...over,
});

const segments: SuggestionSegmentVM[] = [
  { value: "women", label: "Women", selected: true },
  { value: "men", label: "Men", selected: false },
];

function show(over: Partial<KinkstersNearYouProps> = {}) {
  const props: KinkstersNearYouProps = {
    heading: "Kinksters Near You",
    people: [card()],
    segments,
    segmentsLabel: "Show",
    onShow: vi.fn(),
    loading: false,
    browseHref: "/members",
    browseLabel: "Browse all kinksters",
    onToggleFollow: vi.fn(),
    onRemove: vi.fn(),
    labels,
    ...over,
  };
  render(<KinkstersNearYou {...props} />);
  return props;
}

describe("Kinksters Near You", () => {
  it("shows the card's lines and the Online badge only for members online now", () => {
    show({
      people: [
        card({ userId: "u1", displayName: "Lily Rose", online: true }),
        card({ userId: "u2", displayName: "Nyla", online: false }),
      ],
    });
    const [lily, nyla] = screen.getAllByRole("listitem");
    expect(within(lily).getByText("Online")).toBeTruthy();
    expect(within(nyla).queryByText("Online")).toBeNull();
    expect(within(lily).getByText("26F • Lagos, Lagos State, Nigeria")).toBeTruthy();
    expect(within(lily).getByText("Submissive, Switch, Brat")).toBeTruthy();
    expect(within(lily).getByText("Looking for")).toBeTruthy();
    expect(within(lily).getByText("Friendship, Events")).toBeTruthy();
  });

  it("says why a member is suggested, under their name, when there's a reason", () => {
    show({
      people: [
        card({ userId: "u1", reason: "3 mutual friends" }),
        card({ userId: "u2", displayName: "Nyla", reason: null }),
      ],
    });
    const [lily, nyla] = screen.getAllByRole("listitem");
    expect(within(lily).getByText("3 mutual friends")).toBeTruthy();
    expect(within(nyla).queryByText(/mutual/)).toBeNull();
  });

  it("follows and removes the member on the card", () => {
    const props = show();
    fireEvent.click(screen.getByRole("button", { name: "Follow" }));
    expect(props.onToggleFollow).toHaveBeenCalledWith("u1");
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(props.onRemove).toHaveBeenCalledWith("u1");
  });

  it("reads Following once followed, and holds the button while a follow is on its way", () => {
    show({ people: [card({ isFollowing: true, busy: true })] });
    const button = screen.getByRole("button", { name: "Following" });
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows the organization as its name and Follow, with no person's lines", () => {
    show({
      people: [
        card({ organization: true, details: null, roles: null, lookingFor: null, online: true }),
      ],
    });
    expect(screen.getByText("Official")).toBeTruthy();
    expect(screen.queryByText("Looking for")).toBeNull();
    expect(screen.getByRole("button", { name: "Follow" })).toBeTruthy();
  });

  it("switches segments, marking the one shown", () => {
    const props = show();
    const women = screen.getByRole("button", { name: "Women" });
    const men = screen.getByRole("button", { name: "Men" });
    expect(women.getAttribute("aria-pressed")).toBe("true");
    expect(men.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(men);
    expect(props.onShow).toHaveBeenCalledWith("men");
  });

  it("links the sliders to the members directory", () => {
    show();
    expect(screen.getByRole("link", { name: "Browse all kinksters" }).getAttribute("href")).toBe(
      "/members",
    );
  });

  it("says when a segment is loading or has nobody, keeping the toggle", () => {
    show({ people: [], loading: true });
    expect(screen.getByText("Loading…")).toBeTruthy();
    cleanup();
    show({ people: [] });
    expect(screen.getByText("No one to suggest here yet.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Men" })).toBeTruthy();
  });

  it("renders nothing with no one to show and no segment to try", () => {
    show({ people: [], segments: [] });
    expect(screen.queryByText("Kinksters Near You")).toBeNull();
  });
});
