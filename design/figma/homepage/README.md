# Kinkord Homepage — Figma pull

Pulled 2026-08-18 from Figma via MCP.

- **File:** [Kinkord Homepage — Launch](https://www.figma.com/design/BIcp5EnoAPjkOBHZ6MNCXo/Kinkord-Homepage-%E2%80%94-Launch)
- **Frame:** `1:5` "Kinkord Homepage" — **744 × 1600** (mobile-first, single page on the canvas)
- **Render:** [full-frame.png](full-frame.png) (744×1600 export of the whole frame)
- **Reference code:** [reference-code.md](reference-code.md) — Figma's generated React+Tailwind. It is a *reference only* (absolute positioning, raw hex); adapt to project layers/conventions per `AGENTS.md`, do not paste verbatim.
- The link's original `node-id=69-2296` is a loose standalone LOGO element beside the frame, saved as `assets/kinkord-logo-standalone.png`.

## Sections (top → bottom)

| Section | Nodes | Notes |
|---|---|---|
| Hero | `7:2` IMAGE, `7:3` LOGO (191×191), `6:4` wordmark (316×106), `1:6` atmosphere bg `#0b0a07` | Crowd photo, dark overlay feel |
| Tagline | `1:27` | "THE WORLD'S KINK COMMUNITY", tracking 5px, + gold divider `1:28` |
| Countdown card | `22:2` | Border `#faab14`, radius 22, bg `#050504`; "KINKORD LAUNCHES IN" / `500 : 01 : 01 : 20` / DAYS HOURS MINS SECS |
| SIGN UP CTA | `18:2` | Solid `#ffd147`, radius 22, 624×88, black circle icon + `●` glyph, `→` arrow |
| LOG IN CTA | `16:2` | Outline 1.5px `#faab14` on `#020202`, radius 22, `↪` glyph, `→` arrow |
| Secondary nav | `1:45`–`1:56` | Card bg `#090908`, border `#1a1a17`, radius 20; rows: KINKOPEDIA `▣`, ABOUT KINKORD `ⓘ`, CONTACT US `☎`, chevrons `›` `#c2bfb2` |
| Footer | `29:6`, `1:61` | Gold line + "T" badge (border `#faab14`, radius 18); "POWERED BY (white) TEMAXIRO LIMITED (gold)" |

## Palette (no Figma variables defined — raw hex in design)

| Hex | Usage |
|---|---|
| `#000000` | Page background |
| `#0b0a07` | Hero atmosphere background |
| `#050504` | Countdown card bg |
| `#020202` | LOG IN bg, badge bg, icon circle |
| `#090908` | Secondary nav card bg |
| `#1a1a17` | Nav card border + row dividers |
| `#faab14` | Gold — dividers, card/badge borders |
| `#ffba1f` | Bright gold — countdown digits, nav icons, TEMAXIRO |
| `#ffd147` | CTA yellow — SIGN UP bg, LOG IN glyph |
| `#faf7ed` | Cream — headings/labels |
| `#c2bfb2` | Muted — chevrons |
| `#030302` | Near-black — text on yellow CTA |

Glow used on countdown digits / arrows / badge T: `text-shadow: 0 0 12px rgba(255,148,13,0.32)`.

## Typography

All **Inter**: SemiBold (tagline 22/tracking 5, countdown label 21, nav rows 22), ExtraBold (countdown digits 58/tracking 1.2, CTA labels 30, badge T 38), Bold (icon glyphs 24), Black (footer 24/tracking 2.5), Regular (arrows 44, chevrons 38).
Note: repo currently uses Playfair Display + Inter; design uses Inter only — reconcile at implementation time.

## Assets

### Placed assets (`assets/`)

| File | Size | Used as |
|---|---|---|
| `hero-crowd.jpg` | 1280×853 | Hero background (`7:2`) — JPEG despite Figma serving it as .png |
| `kinkord-logo.png` | 640×640 | Hero logo roundel (`7:3`) |
| `kinkord-wordmark.png` | 1280×427 | KINKORD wordmark (`6:4`) |
| `cta-icon.svg` | 48×48 | Black circle behind CTA icon glyphs |
| `kinkord-logo-standalone.png` | 181×163 | The loose LOGO node (`69:2296`) from the shared link |

### Raw originals (`assets/raw/`) — other resolutions of the same art uploaded to the file

| File | Size | Identity |
|---|---|---|
| `logo-raw-02.png` | **1280×1154** | Highest-res logo original (bigger than any placed asset) |
| `logo-raw-03.jpeg` | 1280×1154 | Same art, JPEG |
| `logo-raw-04.png` | 512×461 | Logo @512 |
| `logo-raw-01.jpeg` | 320×289 | Logo small |
| `frame-raw-01.png` | 512×512 | Logo square @512 |
| `frame-raw-10.jpeg` | 320×320 | Logo square small |
| `frame-raw-07.jpeg` | 640×640 | Logo square JPEG |
| `frame-raw-03.jpeg` | 1280×427 | Wordmark JPEG |
| `frame-raw-09.png` | 512×170 | Wordmark @512 |
| `frame-raw-02.jpeg` | 320×107 | Wordmark small |
| `frame-raw-08.jpeg` | 320×214 | Hero photo small |

Byte-identical duplicates between the frame pull and the logo-node pull were removed.

## Implementation notes

- Countdown placeholder `500 : 01 : 01 : 20` ≈ the Dec 28 2027 launch date already wired in `src/constants/landing.ts` (`LAUNCH_DATE`) — keep driving it from there.
- Nav icons (`▣ ⓘ ☎ › ● ↪ →`) are **text glyphs** in the design, not vector icons — pick a real icon set at implementation time.
- Design is one 744-wide mobile frame; no desktop frame exists yet.
