// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { getTheme, setTheme, THEME_STORAGE_KEY, themeInitScript, toggleTheme } from "./theme";

// This project's jsdom build ships no localStorage; stub the Storage contract.
const store = new Map<string, string>();
beforeEach(() => {
  delete document.documentElement.dataset.theme;
  store.clear();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    },
  });
});

describe("theme util", () => {
  it("defaults to light when no theme attribute is set", () => {
    expect(getTheme()).toBe("light");
  });

  it("persists and applies the chosen theme", () => {
    setTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(store.get(THEME_STORAGE_KEY)).toBe("dark");
    expect(getTheme()).toBe("dark");
  });

  it("toggles between light and dark", () => {
    setTheme("light");
    expect(toggleTheme()).toBe("dark");
    expect(toggleTheme()).toBe("light");
  });

  it("honors a stored theme when the init script runs", () => {
    store.set(THEME_STORAGE_KEY, "dark");
    eval(themeInitScript);
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
