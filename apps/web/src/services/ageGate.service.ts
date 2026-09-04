const STORAGE_KEY = "kinkord_age_confirmed";

export class AgeGateService {
  isConfirmed(): boolean {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  }

  confirm(): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // ignore local storage errors (e.g. private browsing restrictions)
    }
  }

  reset(): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

export const ageGateService = new AgeGateService();
