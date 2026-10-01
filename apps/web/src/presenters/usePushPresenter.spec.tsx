// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { PUSH_COPY } from "@/constants/push";
import type { PushState } from "@/domain/push";

// Hoisted with the mock, which runs before this file's own top-level code.
const svc = vi.hoisted(() => ({
  state: vi.fn<() => Promise<PushState>>(),
  enable: vi.fn<() => Promise<PushState>>(),
  disable: vi.fn<() => Promise<PushState>>(),
  test: vi.fn<() => Promise<number>>(),
}));
vi.mock("@/services/push.service", () => ({ pushService: svc }));

import { usePushPresenter } from "./usePushPresenter";

async function ready(state: PushState) {
  svc.state.mockResolvedValue(state);
  const hook = renderHook(() => usePushPresenter());
  await waitFor(() =>
    expect(hook.result.current.settings.description).toBe(PUSH_COPY.describe[state]),
  );
  return hook;
}

describe("usePushPresenter", () => {
  beforeEach(() => {
    Object.values(svc).forEach((f) => f.mockReset());
    svc.test.mockResolvedValue(1);
    localStorage.clear();
  });
  afterEach(cleanup);

  it("offers to turn notifications on, in settings and as a card", async () => {
    const { result } = await ready("off");
    expect(result.current.settings).toMatchObject({
      actionLabel: PUSH_COPY.turnOn,
      actionDisabled: false,
    });
    expect(result.current.prompt).toMatchObject({
      text: PUSH_COPY.prompt.enable,
      actionLabel: PUSH_COPY.turnOn,
    });
  });

  it("turns them on and sends a first one to show it works", async () => {
    svc.enable.mockResolvedValue("on");
    const { result } = await ready("off");
    await act(async () => result.current.settings.onAction());
    expect(result.current.settings.description).toBe(PUSH_COPY.describe.on);
    expect(result.current.settings.actionLabel).toBe(PUSH_COPY.turnOff);
    expect(svc.test).toHaveBeenCalled();
    expect(result.current.prompt).toBeNull();
  });

  it("turns them off", async () => {
    svc.disable.mockResolvedValue("off");
    const { result } = await ready("on");
    await act(async () => result.current.settings.onAction());
    await waitFor(() => expect(result.current.settings.description).toBe(PUSH_COPY.describe.off));
  });

  it("remembers 'Not now' on this device", async () => {
    const { result, unmount } = await ready("off");
    act(() => result.current.prompt?.onDismiss());
    expect(result.current.prompt).toBeNull();
    unmount();
    const again = await ready("off");
    expect(again.result.current.prompt).toBeNull();
  });

  it("on iPhone Safari, explains installing first and offers no button", async () => {
    const { result } = await ready("install");
    expect(result.current.prompt).toMatchObject({
      text: PUSH_COPY.prompt.install,
      actionLabel: null,
    });
    expect(result.current.settings.actionDisabled).toBe(true);
  });

  it("can't toggle once blocked in the browser", async () => {
    const { result } = await ready("blocked");
    expect(result.current.settings.actionDisabled).toBe(true);
    expect(result.current.prompt).toBeNull();
  });

  it("says so when turning on fails", async () => {
    svc.enable.mockRejectedValueOnce(new Error("network"));
    const { result } = await ready("off");
    await act(async () => result.current.settings.onAction());
    expect(result.current.settings.error).toBe(PUSH_COPY.failed);
  });
});
