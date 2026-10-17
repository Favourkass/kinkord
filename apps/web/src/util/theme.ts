/** Kinkord has one permanent black theme. Old saved Light choices are ignored. */
export type Theme = "dark";
export const THEME_STORAGE_KEY = "kinkord-theme";
export const themeInitScript = `(function(){document.documentElement.dataset.theme="dark";document.documentElement.style.colorScheme="dark";try{localStorage.setItem("${THEME_STORAGE_KEY}","dark");}catch(e){}})();`;
export function getTheme(): Theme {
  return "dark";
}
export function setTheme(_theme: string): void {
  void _theme; // Compatibility for callers with a saved legacy choice.
  document.documentElement.dataset.theme = "dark";
  document.documentElement.style.colorScheme = "dark";
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
  } catch {}
}
export function toggleTheme(): Theme {
  setTheme("dark");
  return "dark";
}
