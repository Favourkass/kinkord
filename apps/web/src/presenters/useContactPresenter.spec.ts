// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useContactPresenter } from "./useContactPresenter";

const push = vi.fn();
const router = { push, replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const signOut = vi.fn();
vi.mock("@/services/authClient", () => ({
  authClient: { signOut: (...a: unknown[]) => signOut(...a) },
}));

vi.mock("@/services/apiClient", () => ({
  api: { get: vi.fn().mockResolvedValue({ avatarUrl: "https://avatar.png" }) },
}));

describe("useContactPresenter", () => {
  beforeEach(() => {
    push.mockClear();
    signOut.mockReset().mockResolvedValue({});
  });

  it("provides complete view model data matching mockup requirements", () => {
    const { result } = renderHook(() => useContactPresenter());

    expect(result.current.brand).toBe("KINKORD");
    expect(result.current.headline).toBe("CONTACT US");
    expect(result.current.lead).toBe("We're here to help.");
    expect(result.current.subcopy).toContain("Reach out to us for support");
    expect(result.current.getInTouchHeading).toBe("GET IN TOUCH");
    expect(result.current.chooseTopicHeading).toBe("CHOOSE A TOPIC");

    // Channels
    expect(result.current.channels).toHaveLength(4);
    const email = result.current.channels.find((c) => c.id === "email");
    expect(email?.value).toBe("support@kinkord.com");
    expect(email?.href).toBe("mailto:support@kinkord.com");

    const whatsapp = result.current.channels.find((c) => c.id === "whatsapp");
    expect(whatsapp?.value).toBe("09127883266");
    expect(whatsapp?.href).toBe("https://wa.me/2349127883266");

    const phone = result.current.channels.find((c) => c.id === "phone");
    expect(phone?.value).toBe("09127883266");
    expect(phone?.href).toBe("tel:09127883266");

    const twitter = result.current.channels.find((c) => c.id === "twitter");
    expect(twitter?.value).toBe("@kinkordlimited");
    expect(twitter?.href).toBe("https://x.com/kinkordlimited");

    // Office
    expect(result.current.office.company).toBe("Kinkord Limited");
    expect(result.current.office.addressLines).toContain("13 Obire Street, Sapele, Delta State, Nigeria");

    // Notices
    expect(result.current.safetyNotice.title).toBe("SAFETY NOTICE");
    expect(result.current.importantNotice.title).toBe("IMPORTANT NOTICE");

    // Topics
    expect(result.current.topics).toHaveLength(6);
    const problem = result.current.topics.find((t) => t.id === "problem");
    expect(problem?.isAlert).toBe(true);
    expect(problem?.href).toContain("mailto:support@kinkord.com");
  });

  it("handles drawer open and close transitions", () => {
    const { result } = renderHook(() => useContactPresenter());

    expect(result.current.drawerOpen).toBe(false);

    act(() => {
      result.current.openDrawer();
    });
    expect(result.current.drawerOpen).toBe(true);

    act(() => {
      result.current.closeDrawer();
    });
    expect(result.current.drawerOpen).toBe(false);
  });

  it("handles topic selection", () => {
    const { result } = renderHook(() => useContactPresenter());

    expect(result.current.selectedTopic).toBeNull();

    const topic = result.current.topics[0];
    act(() => {
      result.current.selectTopic(topic);
    });
    expect(result.current.selectedTopic?.id).toBe(topic.id);
  });

  it("handles logout and redirection to login", async () => {
    const { result } = renderHook(() => useContactPresenter());

    await act(async () => {
      result.current.onLogout();
    });

    expect(signOut).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/login");
  });
});
