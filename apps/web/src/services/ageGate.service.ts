const STORAGE_KEY = "kinkord_age_confirmed";

export class AgeGateService {
  private subscribers = new Set<() => void>();
  private inMemoryConfirmed = false;

  /** Subscribe to confirmation changes (for useSyncExternalStore). */
  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notify(): void {
    this.subscribers.forEach((cb) => cb());
  }

  isConfirmed(): boolean {
    if (this.inMemoryConfirmed) return true;
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  }

  confirm(): void {
    this.inMemoryConfirmed = true;
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, "true");
      } catch {
        // ignore local storage errors (e.g. private browsing restrictions)
      }
    }
    this.notify();
  }

  reset(): void {
    this.inMemoryConfirmed = false;
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    this.notify();
  }
}

export const ageGateService = new AgeGateService();
