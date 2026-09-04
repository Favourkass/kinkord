# Landing Page redesign — Figma pull notes (2026-08-30)

Source: https://www.figma.com/design/BIcp5EnoAPjkOBHZ6MNCXo/KINKORD?node-id=452-107
File key `BIcp5EnoAPjkOBHZ6MNCXo`, canvas `452:107` ("Landing Page").

## What's here

- `canvas-452-107-full.png` — full canvas render (1600px, clamped from 1995×1275)
- `mobile-452-153.png` — Mobile frame crop (node `452:153`, natural 402×902)
- `desktop-468-294.png` — Desktop frame crop (node `468:294`, natural 1512×982)

## Design summary

Gold page background with a dark rounded panel. Circular gold "K" badge logo
(NEW mark), "Download Kinkord" gold pill top-right, KINKORD display heading +
tagline, solid-gold SIGN UP (user icon) + outline login (log-in icon),
secondary nav buttons KINKOPEDIA / ABOUT KINKORD / CONTACT US with gold
chevrons, footer "© 2026 Kinkord Limited. A Temaxiro Company".
Mobile: full-bleed black satin texture, centered logo, hero photo mid-screen,
stacked buttons, nav rows in one card. Desktop: photo fills right half of the
panel (three figures in black satin).

## Still to pull (blocked by Figma MCP seat limit on the View seat)

- Circular "K" logo as SVG/hi-res (mobile `452:155`, desktop `468:298`)
- Hero photo raw image fill (three figures) + mobile satin background texture
- 2x frame exports for pixel checks

Icons likely reusable from earlier pulls: `../homepage-desktop/assets/{signup-icon,login-icon}.svg`;
chevrons are trivial. Key node IDs — mobile: signup btn `452:156`, signin `452:159`,
nav card `452:164`; desktop: panel `479:25`, download pill `468:296`, signup `468:299`,
signin `472:329`, nav buttons `472:335`/`479:15`/`479:19`.

Unblock: Figma REST API with a personal access token (works on any plan/seat that
can view the file) — `GET /v1/files/:key/images` for raw fills,
`GET /v1/images/:key?ids=...&format=svg|png&scale=2` for exports. Or designer
exports from Figma directly. MCP quota resets with the billing cycle.
