// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import SignupPage from "./page";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/presenters/useSignupWizardPresenter", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/presenters/useSignupWizardPresenter")>();
  return { useSignupWizardPresenter: () => original.useSignupWizardPresenter("account") };
});
it("renders account signup without phone entry or phone instructions", () => {
  render(<SignupPage />);
  expect(screen.getByLabelText("Email address")).toBeTruthy();
  expect(screen.getByLabelText("Username")).toBeTruthy();
  expect(screen.queryByText(/phone number/i)).toBeNull();
  expect(screen.queryByText(/one number can only/i)).toBeNull();
  expect(document.querySelector('input[type="tel"]')).toBeNull();
});
