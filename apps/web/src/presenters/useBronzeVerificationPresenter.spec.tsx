// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replace, status, consent, start } = vi.hoisted(() => ({
  replace: vi.fn(),
  status: vi.fn(),
  consent: vi.fn(),
  start: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

vi.mock("@/services/bronzeVerification.service", () => ({
  bronzeVerificationApi: { status, consent, start },
}));

import { useBronzeVerificationPresenter } from "./useBronzeVerificationPresenter";

const verification = {
  status: "not_started" as const,
  attemptsUsed: 0,
  attemptsRemaining: 3,
  consented: false,
  policyVersion: "identity-v1",
  missing: [],
  providerAvailable: true,
  provider: "didit" as const,
  policyUrl: "/verification/privacy",
};

describe("useBronzeVerificationPresenter", () => {
  beforeEach(() => {
    replace.mockClear();
    status.mockReset().mockResolvedValue(verification);
    consent.mockReset().mockResolvedValue({ ...verification, consented: true });
    start.mockReset();
  });

  it("requires confirmation before enabling an available Didit session", async () => {
    const { result } = renderHook(() => useBronzeVerificationPresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.view?.canStart).toBe(false);
    act(() => result.current.view?.onChecked(true));
    expect(result.current.view?.canStart).toBe(true);
    expect(result.current.view?.attemptsRemaining).toBe(3);
  });
});
