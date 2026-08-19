# Kinkord Homepage (Desktop) — Figma pull

Pulled 2026-08-18 from Figma via MCP.

- **File:** [KINKORD](https://www.figma.com/design/BIcp5EnoAPjkOBHZ6MNCXo/KINKORD?node-id=2-5)
- **Page:** `2:5` "KINKORD HOMEPAGE DESKTOP VERSION"
- **Frame:** `67:522` "Desktop - 2" — **1440 × 900**
- **Render:** [full-frame.png](full-frame.png) (1440×900 export)
- **Reference code:** [reference-code.md](reference-code.md) — reference only; adapt per `AGENTS.md`.
- Companion mobile pull: [`../homepage/`](../homepage/README.md) (744×1600, frame `1:5`).

## Layout (single 1440×900 viewport, no scroll)

| Region | Nodes | Notes |
|---|---|---|
| Top navbar | `67:523` bar (black, h56, radius 6), `67:572` wordmark img (176×59), loose `67:529` TOP LOGO (56×56) | Logo + KINKORD wordmark top-left |
| Hero | frame bg image (full-bleed), `69:2296` LOGO (181×163) | 4-person photo, gold-lit |
| Headline | `70:2302` text `KINK   RD` (Inter Black 64, tracking 5, `#faab14`) + `70:2303` KEY image (51×53) filling the O gap | **Wordmark is TEXT + image glyph on desktop**, not a flat image |
| Tagline | `70:2299` | 22px, tracking 5, `#faf7ed`, + gold dividers `67:570`/`70:2306` (`#d4af37`) |
| Countdown card | `67:593` | Same treatment as mobile: `#050504` bg, `#faab14` border, radius 22, 624×145 |
| CTAs side-by-side | `67:546` SIGN UP (394×88, bg `#faab14`), `67:561` LOG IN (400×88, outline 1.5 `#faab14`) | Note: desktop SIGN UP bg is `#faab14` (mobile used `#ffd147`) |
| Bottom strip nav | `67:2278` bar (`#160e01`, 1130×59), `67:2265/2282/2292` | ▣ KINKOPEDIA · ⓘ ABOUT KINKORD · ☎ CONTACT US, horizontal |
| Footer | `67:2293` | "POWERED BY (white) TEMAXIRO LIMITED (gold `#ffba1f`)" |

## Deltas vs mobile design

- Gold divider is **`#d4af37`** here vs `#faab14` on mobile — likely designer inconsistency; flag before implementing.
- SIGN UP button bg **`#faab14`** vs mobile `#ffd147`; its `●` glyph is `#faab14` on `#020202` circle.
- KINKORD headline is **live text + KEY image** here; mobile uses a flat wordmark PNG.
- Nav is a horizontal strip, not a stacked card; no chevrons.
- Text color `#f2f2f7` appears (nav labels), backed by real **Figma variables**: `Backgrounds/Secondary` = `#f2f2f7` (first variables in the file).
- CTA icon SVGs here are ellipses (30.77×48, 30.33×48) vs mobile's 48×48 circle.

## Assets

### Placed (`assets/`)

| File | Size | Used as |
|---|---|---|
| `hero-bg-composite.png` | 1024×560 | Frame background as served by design context (composite, reduced res) — prefer `raw/frame-raw-06.jpeg` 1280×700 original for implementation |
| `kinkord-logo.png` | 1280×1154 | Hero LOGO (`69:2296`) — byte-identical to mobile `raw/logo-raw-02.png` |
| `top-nav-wordmark.jpg` | 1280×427 | Navbar wordmark (`67:572`) — JPEG bytes though Figma served `.png`; identical to mobile `raw/frame-raw-03.jpeg` |
| `key-glyph.png` | 82×85 | Horned-O "KEY" inside the KINKORD headline (`70:2303`) |
| `top-logo.png` | 56×56 | Loose TOP LOGO node (`67:529`) export |
| `signup-icon.svg` | 30.33×48 | Black ellipse behind SIGN UP `●` |
| `login-icon.svg` | 30.77×48 | Black ellipse behind LOG IN `↪` |

### Raw originals (`assets/raw/`)

| File | Size | Identity |
|---|---|---|
| `frame-raw-06.jpeg` | **1280×700** | **Desktop hero photo original** (new art, not in mobile pull) |
| `frame-raw-01.jpeg` | 320×175 | Desktop hero small |
| `toplogo-raw-01.jpeg` | **1024×1024** | Square logo original (highest-res square in file) |
| `toplogo-raw-02.jpeg` | 512×512 | Square logo @512 |
| `frame-raw-03.jpeg` | 82×85 | KEY glyph JPEG |
| `frame-raw-07.png` | 82×85 | KEY glyph PNG variant |
| `frame-raw-02.jpeg` | 320×289 | Logo small — identical to mobile `logo-raw-01.jpeg` |
| `frame-raw-04.jpeg` | 320×107 | Wordmark small — identical to mobile `frame-raw-02.jpeg` |
| `frame-raw-05.png` | 512×461 | Logo @512 — identical to mobile `logo-raw-04.png` |
| `frame-raw-08.jpeg` | 1280×1154 | Logo JPEG — identical to mobile `logo-raw-03.jpeg` |

Duplicates *within* this pull were deleted; duplicates *across* pulls were kept so each folder stands alone (identities noted above).

## Implementation notes

- Desktop hero: don't ship `hero-bg-composite.png` (it has the dark bar baked in at reduced res) — rebuild from `frame-raw-06.jpeg` + overlays.
- Same glyph-as-icon caveat as mobile (`▣ ⓘ ☎ ● ↪ →` are text).
- A third page exists in the file: **"KINKORD COUNTRY SELECTION"** — not pulled yet.
