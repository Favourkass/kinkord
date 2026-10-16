// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AgeGateModal from "@/components/ui/AgeGateModal";
import { useLandingPresenter } from "@/presenters/useLandingPresenter";
import { ageGateService } from "@/services/ageGate.service";
import { pwaService } from "@/services/pwa.service";

describe("landing age confirmation", () => {
  beforeEach(() => {
    ageGateService.reset();
    localStorage.clear();
    vi.restoreAllMocks();
    // Reset shared singleton state between tests.
    pwaService.setDeferredPrompt(null);
    pwaService.closeInstallGuide();
    vi.spyOn(pwaService, "registerServiceWorker").mockResolvedValue(null);
    vi.spyOn(pwaService, "isStandalone").mockReturnValue(false);
    vi.spyOn(pwaService, "isIosDevice").mockReturnValue(false);
    vi.spyOn(pwaService, "isAndroidDevice").mockReturnValue(false);
    vi.spyOn(pwaService, "isOnline").mockReturnValue(true);
  });

  it("dismisses the actual age dialog and remembers confirmation when Enter is clicked", () => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    });
    function LandingAgeGate() {
      const vm = useLandingPresenter();
      return (
        <AgeGateModal
          {...vm.ageGate}
          open={vm.showAgeGate}
          onConfirm={vm.onConfirmAge}
          onDecline={vm.onDeclineAge}
        />
      );
    }
    const { unmount } = render(<LandingAgeGate />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "I AM 18 OR OLDER — ENTER" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(localStorage.getItem("kinkord_age_confirmed")).toBe("true");
    expect(document.body.style.overflow).not.toBe("hidden");
    unmount();
    const remounted = render(<LandingAgeGate />);
    expect(screen.queryByRole("dialog")).toBeNull();
    remounted.unmount();
  });
});
