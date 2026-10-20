// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useGroupFormPresenter } from "./useGroupFormPresenter";

const router = { push: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const svc = { options: vi.fn(), detail: vi.fn(), create: vi.fn(), update: vi.fn() };
vi.mock("@/services/groups.service", () => ({
  groupsService: {
    options: () => svc.options(),
    detail: (...a: unknown[]) => svc.detail(...a),
    create: (...a: unknown[]) => svc.create(...a),
    update: (...a: unknown[]) => svc.update(...a),
  },
}));

const silver = {
  categories: ["local", "interests"],
  canCreate: true,
  refusal: null,
  refusalMessage: null,
};
const detail = (isOwner: boolean) => ({
  slug: "lagos-munch",
  name: "Lagos Munch",
  description: "A monthly munch in Lagos.",
  rules: null,
  category: "local",
  privacy: "open",
  country: "NG",
  state: "Lagos",
  access: {
    member: true,
    pending: false,
    canRead: true,
    canPost: true,
    canModerate: true,
    isOwner,
  },
});

beforeEach(() => {
  router.push.mockReset();
  svc.options.mockReset().mockResolvedValue(silver);
  svc.detail.mockReset();
  svc.create.mockReset().mockResolvedValue({ slug: "lagos-munch" });
  svc.update.mockReset().mockResolvedValue({});
});
afterEach(cleanup);

describe("useGroupFormPresenter", () => {
  it("tells a Basic member creating is part of Silver, with the way there", async () => {
    svc.options.mockResolvedValue({
      categories: ["local"],
      canCreate: false,
      refusal: "silver",
      refusalMessage: "Creating a group is part of Silver.",
    });
    const { result } = renderHook(() => useGroupFormPresenter());
    await waitFor(() =>
      expect(result.current.blocked).toEqual({
        message: "Creating a group is part of Silver.",
        action: { label: "Get Silver", href: "/subscription" },
      }),
    );
  });

  it("checks the fields before sending anything", async () => {
    const { result } = renderHook(() => useGroupFormPresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.name.onChange("ab"));
    await act(async () => result.current.submit.onClick());
    expect(result.current.name.error).toBe("Use 3–60 characters.");
    expect(result.current.description.error).toBe("Use 10–2,000 characters.");
    expect(svc.create).not.toHaveBeenCalled();
  });

  it("creates the group and opens it", async () => {
    const { result } = renderHook(() => useGroupFormPresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      result.current.name.onChange("Lagos Munch");
      result.current.description.onChange("A monthly munch in Lagos.");
      result.current.privacy.onChange("closed");
      result.current.location.country.onChange("NG");
    });
    act(() => result.current.location.state?.onChange("Lagos"));
    await act(async () => result.current.submit.onClick());
    expect(svc.create).toHaveBeenCalledWith({
      name: "Lagos Munch",
      description: "A monthly munch in Lagos.",
      rules: null,
      category: "local",
      privacy: "closed",
      country: "NG",
      state: "Lagos",
    });
    expect(router.push).toHaveBeenCalledWith("/g/lagos-munch");
  });

  it("lets a moderator edit but only the owner rename, and never changes who can join", async () => {
    svc.detail.mockResolvedValue(detail(false));
    const { result } = renderHook(() => useGroupFormPresenter("lagos-munch"));
    await waitFor(() => expect(result.current.name.value).toBe("Lagos Munch"));
    expect(result.current.name.disabled).toBe(true);
    expect(result.current.privacy.locked).toBeTruthy();
    act(() => result.current.description.onChange("A monthly munch in Lagos, all welcome."));
    await act(async () => result.current.submit.onClick());
    expect(svc.update).toHaveBeenCalledWith("lagos-munch", {
      description: "A monthly munch in Lagos, all welcome.",
      rules: null,
      category: "local",
      country: "NG",
      state: "Lagos",
    });
    expect(router.push).toHaveBeenCalledWith("/g/lagos-munch");
  });
});
