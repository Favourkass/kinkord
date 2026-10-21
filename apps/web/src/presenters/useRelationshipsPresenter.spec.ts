// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RelationshipPM, RelationshipsPM } from "@/domain/relationship";
import { useRelationshipsPresenter } from "./useRelationshipsPresenter";

const options = vi.fn();
const list = vi.fn();
const request = vi.fn();
const accept = vi.fn();
const remove = vi.fn();
vi.mock("@/services/relationships.service", async (original) => ({
  ...(await original<typeof import("@/services/relationships.service")>()),
  relationshipsApi: {
    options: () => options(),
    list: () => list(),
    request: (...a: unknown[]) => request(...a),
    accept: (...a: unknown[]) => accept(...a),
    remove: (...a: unknown[]) => remove(...a),
  },
}));

const pm = (over: Partial<RelationshipPM>): RelationshipPM => ({
  id: "r1",
  kind: "ds",
  type: "dominant",
  label: "Dominant of",
  member: { userId: "u2", username: "ada", displayName: "Ada", avatarUrl: null },
  requestedBy: "other",
  createdAt: "2026-10-21T09:00:00.000Z",
  acceptedAt: null,
  ...over,
});
const empty: RelationshipsPM = { links: [], incoming: [], outgoing: [] };

beforeEach(() => {
  options.mockReset().mockResolvedValue({
    ds: [{ type: "dominant", dominant: "Dominant", submissive: "submissive" }],
    romantic: [{ type: "married", label: "Married to" }],
  });
  list.mockReset().mockResolvedValue(empty);
  for (const f of [request, accept, remove]) f.mockReset().mockResolvedValue(empty);
});
afterEach(cleanup);

describe("useRelationshipsPresenter", () => {
  it("waits for a signed-in member, then loads the choices and the list", async () => {
    const { result, rerender } = renderHook(({ ready }) => useRelationshipsPresenter(ready, null), {
      initialProps: { ready: false },
    });
    expect(list).not.toHaveBeenCalled();
    rerender({ ready: true });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.form.choices).toEqual({
      ds: [{ value: "dominant", label: "submissive of them (they're your Dominant)" }],
      romantic: [{ value: "married", label: "Married to them" }],
    });
  });

  it("opens ready for the member named in ?with=", () => {
    const { result } = renderHook(() => useRelationshipsPresenter(false, "Tolu"));
    expect(result.current.form.username).toBe("@tolu");
  });

  it("needs a username and a choice before asking", async () => {
    const { result } = renderHook(() => useRelationshipsPresenter(true, null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.form.setUsername("@tolu"));
    act(() => result.current.form.submit());
    expect(result.current.form.error).toBe("Enter their username and choose what you are to them.");
    expect(request).not.toHaveBeenCalled();
  });

  it("sends a request, then shows it waiting and clears the form", async () => {
    request.mockResolvedValue({
      ...empty,
      outgoing: [
        pm({
          requestedBy: "self",
          label: "submissive of",
          member: { ...pm({}).member, displayName: "Tolu" },
        }),
      ],
    });
    const { result } = renderHook(() => useRelationshipsPresenter(true, null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.form.setUsername(" @Tolu "));
    act(() => result.current.form.setType("dominant"));
    await act(async () => result.current.form.submit());
    expect(request).toHaveBeenCalledWith("tolu", "dominant");
    expect(result.current.notice).toBe("Request sent to @tolu. It shows once they accept.");
    expect(result.current.outgoing.map((r) => r.line)).toEqual(["You'd be submissive of Tolu"]);
    expect(result.current.form.username).toBe("");
  });

  it("shows the API's refusal and keeps what was typed", async () => {
    request.mockRejectedValue(
      new Error("You and @tolu already have a D/s link, or a request waiting."),
    );
    const { result } = renderHook(() => useRelationshipsPresenter(true, null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.form.setUsername("tolu"));
    act(() => result.current.form.setType("dominant"));
    await act(async () => result.current.form.submit());
    expect(result.current.form.error).toBe(
      "You and @tolu already have a D/s link, or a request waiting.",
    );
    expect(result.current.form.username).toBe("tolu");
  });

  it("accepts a request and says so", async () => {
    list.mockResolvedValue({ ...empty, incoming: [pm({})] });
    accept.mockResolvedValue({ ...empty, links: [pm({ acceptedAt: "2026-10-21T10:00:00.000Z" })] });
    const { result } = renderHook(() => useRelationshipsPresenter(true, null));
    await waitFor(() => expect(result.current.incoming).toHaveLength(1));
    expect(result.current.incoming[0].line).toBe("You'd be Dominant of Ada");
    await act(async () => result.current.incoming[0].accept());
    expect(accept).toHaveBeenCalledWith("r1");
    expect(result.current.notice).toBe("You're now linked with Ada.");
    expect(result.current.links.map((r) => [r.label, r.name, r.href])).toEqual([
      ["Dominant of", "Ada", "/u/ada"],
    ]);
  });

  it("asks before ending a link, then ends it", async () => {
    list.mockResolvedValue({ ...empty, links: [pm({ acceptedAt: "2026-10-21T10:00:00.000Z" })] });
    const { result } = renderHook(() => useRelationshipsPresenter(true, null));
    await waitFor(() => expect(result.current.links).toHaveLength(1));
    act(() => result.current.links[0].end());
    expect(remove).not.toHaveBeenCalled();
    expect(result.current.endConfirm).toMatchObject({
      open: true,
      message:
        "End your link with Ada? It comes off both profiles straight away. They aren't told.",
      confirmLabel: "End link",
      cancelLabel: "Keep link",
    });
    await act(async () => result.current.endConfirm.onConfirm());
    expect(remove).toHaveBeenCalledWith("r1");
    expect(result.current.endConfirm.open).toBe(false);
    expect(result.current.notice).toBe("Your link with Ada has ended.");
  });

  it("declines or cancels a request without asking", async () => {
    list.mockResolvedValue({
      ...empty,
      incoming: [pm({ id: "in" })],
      outgoing: [pm({ id: "out", requestedBy: "self" })],
    });
    const { result } = renderHook(() => useRelationshipsPresenter(true, null));
    await waitFor(() => expect(result.current.outgoing).toHaveLength(1));
    await act(async () => result.current.incoming[0].decline());
    expect(remove).toHaveBeenLastCalledWith("in");
  });

  it("says when the list can't load", async () => {
    list.mockRejectedValue(new Error("down"));
    const { result } = renderHook(() => useRelationshipsPresenter(true, null));
    await waitFor(() => expect(result.current.error).toBe("Something went wrong. Try again."));
    expect(result.current.loading).toBe(false);
  });
});
