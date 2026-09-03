/**
 * Inline early initialization script for PWA beforeinstallprompt capture.
 * Captures beforeinstallprompt at the earliest possible instant (before React hydrates)
 * so that programmatic installation is never missed.
 */
export const pwaInitScript = `(function(){if(typeof window==='undefined')return;window.__kinkord_pwa_prompt=null;window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__kinkord_pwa_prompt=e;window.dispatchEvent(new Event('kinkord:prompt-ready'));});if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(function(){});});}})();`;
